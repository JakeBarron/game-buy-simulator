// Pure reducer for Game Buy Simulator.
//
// See specs/001-game-buy-simulator/contracts/ui-contract.md (action table + the
// normative TICK resolution order) and data-model.md (RunState / Shift / Sale
// shapes, the balance invariant). This file is a direct implementation of
// those documents and should not diverge from them.
//
// PURITY: no Date.now(), no Math.random(), no localStorage, no React. `now`,
// `dt`, and `rand` always arrive on the action — that's what makes a run
// replayable (including "resolve a shift that finished while the tab was
// closed") and testable without mocking global state.

import type { RunState, GameAction, Shift, Sale, Announcement, PurchaseRecord, Listing } from './types';
import type { Config, Range } from './config';
import { shiftProgress, shiftDrain, accrueBonus } from './timeEngine';
import { currentPrice, discountFor, isOwned, hasWon, availableListings } from './economy';
import { GAMES, LISTINGS, STOREFRONTS, SALE_NAMES } from '../data/catalogue';
import { checkAnswer } from './puzzles';

const LISTINGS_BY_ID = new Map<string, Listing>(LISTINGS.map((l) => [l.id, l]));

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

function pickInRange(rand: () => number, range: Range): number {
  return range.min + rand() * (range.max - range.min);
}

/** Midpoint of a range — used only by `initialRun`, which has no `rand` input. */
function rangeMid(range: Range): number {
  return (range.min + range.max) / 2;
}

function pickIndex<T>(items: T[], rand: () => number): T {
  const index = Math.min(items.length - 1, Math.floor(rand() * items.length));
  return items[index];
}

function shuffleWithRand<T>(items: T[], rand: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function initialRun(now: number, config: Config): RunState {
  return {
    schemaVersion: config.SCHEMA_VERSION,
    status: 'playing',
    hoursRemaining: config.STARTING_HOURS,
    startedAt: now,
    ownedGameIds: [],
    history: [],
    shiftsWorked: 0,
    hoursDrained: 0,
    hoursEarned: 0,
    releasedGameIds: [],
    activeShift: null,
    activeSale: null,
    // No `rand` is available here (initialRun's signature deliberately has
    // none) so the very first roll is scheduled at the midpoint of the
    // configured interval, rather than favoring the min or max. Every roll
    // after this one goes through TICK's `rand`-driven scheduling.
    nextSaleAt: now + rangeMid(config.SALE_INTERVAL_MS),
    nextReleaseAt: now + rangeMid(config.RELEASE_INTERVAL_MS),
    endedAt: null,
    welcomeSeen: false,
    activeStorefrontId: STOREFRONTS[0].id,
    announcements: [],
  };
}

// ---------------------------------------------------------------------------
// BUY
// ---------------------------------------------------------------------------

function buy(state: RunState, action: Extract<GameAction, { type: 'BUY' }>, config: Config): RunState {
  if (state.status !== 'playing') return state;

  const listing = LISTINGS_BY_ID.get(action.listingId);
  if (!listing || isOwned(state, listing.gameId)) return state;

  const price = currentPrice(listing, state.activeSale, config);
  if (price > state.hoursRemaining) return state; // never overdraft

  const discountPercent = discountFor(listing, state.activeSale);
  const record: PurchaseRecord = {
    gameId: listing.gameId,
    storefrontId: listing.storefrontId,
    listPrice: listing.price,
    pricePaid: price,
    discountPercent,
    purchasedAt: action.now,
  };

  // If a shift is active, the price ALSO comes off `balanceAtStart`, not
  // just `hoursRemaining`. A shift's death is reconstructed purely from
  // `balanceAtStart` + accumulated drain (see timeEngine.deathDuringShift),
  // with no memory of ticks in between. The player can buy while working
  // (nothing blocks it), so if a mid-shift purchase didn't also lower
  // balanceAtStart, that reconstruction would believe the player started
  // the shift with more money than they actually had left after buying —
  // silently hiding a death that the purchase itself caused.
  const activeShift: Shift | null = state.activeShift
    ? { ...state.activeShift, balanceAtStart: state.activeShift.balanceAtStart - price }
    : state.activeShift;

  let next: RunState = {
    ...state,
    hoursRemaining: state.hoursRemaining - price,
    ownedGameIds: [...state.ownedGameIds, listing.gameId],
    history: [...state.history, record],
    activeShift,
  };

  // Re-check terminal states after the purchase. Dead takes priority over
  // won when a purchase spends the player's exact last hours on the final
  // unowned game (balance hits 0 counts as game over per spec Edge Cases).
  if (next.hoursRemaining <= 0) {
    next = { ...next, status: 'dead', hoursRemaining: 0, activeShift: null, endedAt: action.now };
  } else if (hasWon(next)) {
    // "Player wins while a shift is still running: the shift stops and the
    // victory screen takes over" (spec Edge Cases) — applies here too.
    next = { ...next, status: 'won', activeShift: null, endedAt: action.now };
  }

  return next;
}

// ---------------------------------------------------------------------------
// START_SHIFT / SOLVE_PUZZLE / SET_SPACING_OUT
// ---------------------------------------------------------------------------

function startShift(
  state: RunState,
  action: Extract<GameAction, { type: 'START_SHIFT' }>,
  config: Config,
): RunState {
  if (state.status !== 'playing' || state.activeShift !== null) return state;

  // Deliberately NOT gated on affordability — a shift that will kill the
  // player before it completes is allowed to start (FR-040); TICK's
  // drain/death check is what ends it.
  const shift: Shift = {
    startedAt: action.now,
    workRequiredMs: config.WORK_REQUIRED_MS,
    bonusMs: 0,
    spacingOut: false,
    drainPerWorkMs: config.DRAIN_PER_WORK_MS,
    wage: config.WAGE,
    puzzle: action.puzzle,
    puzzleSolvedAt: null,
    balanceAtStart: state.hoursRemaining,
    drainApplied: 0,
  };

  return { ...state, activeShift: shift };
}

function solvePuzzle(state: RunState, action: Extract<GameAction, { type: 'SOLVE_PUZZLE' }>): RunState {
  const shift = state.activeShift;
  if (!shift || shift.puzzleSolvedAt !== null) return state;
  if (!checkAnswer(shift.puzzle, action.answer)) return state; // wrong answer: no penalty, no state change

  // Recording puzzleSolvedAt is the ONLY effect. It never touches
  // startedAt or workRequiredMs — solving the puzzle does not shorten or
  // extend the shift's clock, which already started at START_SHIFT.
  return { ...state, activeShift: { ...shift, puzzleSolvedAt: action.now } };
}

function setSpacingOut(
  state: RunState,
  action: Extract<GameAction, { type: 'SET_SPACING_OUT' }>,
): RunState {
  const shift = state.activeShift;
  if (!shift || shift.puzzleSolvedAt === null) return state;
  if (shift.spacingOut === action.spacingOut) return state;

  return { ...state, activeShift: { ...shift, spacingOut: action.spacingOut } };
}

// ---------------------------------------------------------------------------
// TICK
// ---------------------------------------------------------------------------

function startSale(state: RunState, now: number, rand: () => number, config: Config): RunState {
  const listings = availableListings(state);
  const nextSaleAt = now + pickInRange(rand, config.SALE_INTERVAL_MS);

  if (listings.length === 0) {
    // Nothing available to discount — reschedule rather than emit an empty sale.
    return { ...state, nextSaleAt };
  }

  const shuffled = shuffleWithRand(listings, rand);
  const fraction = pickInRange(rand, config.SALE_LISTING_FRACTION);
  const count = Math.min(shuffled.length, Math.max(1, Math.round(shuffled.length * fraction)));
  const chosen = shuffled.slice(0, count);

  const discounts: Record<string, number> = {};
  for (const listing of chosen) {
    discounts[listing.id] = Math.round(pickInRange(rand, config.SALE_DISCOUNT_PCT));
  }

  const name = pickIndex(SALE_NAMES, rand);
  const endsAt = now + pickInRange(rand, config.SALE_DURATION_MS);
  const saleId = `sale-${now}-${Math.floor(rand() * 1_000_000)}`;

  const sale: Sale = { id: saleId, name, startedAt: now, endsAt, discounts };
  const announcement: Announcement = {
    id: `announce-${saleId}`,
    kind: 'sale',
    text: `${name}!`,
    expiresAt: now + config.ANNOUNCEMENT_MS,
  };

  return {
    ...state,
    activeSale: sale,
    nextSaleAt,
    announcements: [...state.announcements, announcement],
  };
}

function rollRelease(state: RunState, now: number, rand: () => number, config: Config): RunState {
  const pool = GAMES.filter((g) => g.releasePool && !state.releasedGameIds.includes(g.id));

  if (pool.length === 0) {
    // Pool exhausted: push the next roll far into the future so it stops
    // firing, for the rest of the run. Number.MAX_SAFE_INTEGER, not
    // Infinity — RunState round-trips through JSON.stringify for
    // persistence, and JSON.stringify(Infinity) serializes to `null`.
    return { ...state, nextReleaseAt: Number.MAX_SAFE_INTEGER };
  }

  const game = pickIndex(pool, rand);
  const nextReleaseAt = now + pickInRange(rand, config.RELEASE_INTERVAL_MS);
  const announcement: Announcement = {
    id: `announce-release-${game.id}-${now}`,
    kind: 'release',
    text: `${game.title} just released!`,
    expiresAt: now + config.ANNOUNCEMENT_MS,
  };

  return {
    ...state,
    releasedGameIds: [...state.releasedGameIds, game.id],
    nextReleaseAt,
    announcements: [...state.announcements, announcement],
  };
}

function tick(state: RunState, action: Extract<GameAction, { type: 'TICK' }>, config: Config): RunState {
  const { now, dt, rand } = action;

  // Announcements expire on every tick, including in a terminal state —
  // only sale/release/drain/pay/death are gated on `status === 'playing'`.
  const announcements = state.announcements.filter((a) => a.expiresAt > now);
  const announcementsChanged = announcements.length !== state.announcements.length;

  if (state.status !== 'playing') {
    return announcementsChanged ? { ...state, announcements } : state;
  }

  let next: RunState = announcementsChanged ? { ...state, announcements } : state;

  // --- Steps 0 + 1: bonus accrual, then incremental drain. ---------------
  //
  // `shiftDrain(shift, t, config)` (timeEngine.ts) returns the shift's
  // TOTAL accumulated drain as of `t`, purely as a function of (shift, t).
  // It has no memory of what was already subtracted from hoursRemaining on
  // earlier ticks, so applying its raw value every tick would double-count.
  //
  // Instead we apply only what's NEW: the difference between the total drain
  // as of `now` and `shift.drainApplied`, the running total already charged
  // to the balance on previous ticks.
  //
  // Deliberately NOT `shiftDrain(now) - shiftDrain(now - dt)`: `dt` is the
  // gap between ticks THIS SESSION, so it is 0 on the boot tick and a shift
  // that advanced while the tab was closed would never be charged for that
  // time — closing the tab would become a way to work for free. Anchoring on
  // a stored cumulative total instead makes drain application independent of
  // tick cadence and self-correcting across reloads. shiftDrain caps
  // work-time at workRequiredMs internally, so even a tick spanning hours
  // yields exactly one shift's worth of drain.
  const originalShift = next.activeShift;
  if (originalShift) {
    const bonusMs = originalShift.spacingOut
      ? accrueBonus(originalShift, dt, config)
      : originalShift.bonusMs;
    const updatedShift: Shift = { ...originalShift, bonusMs };

    const drainNow = shiftDrain(updatedShift, now, config);
    const rawDelta = Math.max(0, drainNow - originalShift.drainApplied);

    // Clamp the applied delta to the balance actually available. Without
    // this, a tick that drains past zero would subtract the full
    // (overshooting) delta from hoursDrained while hoursRemaining gets
    // clamped to 0 below in the death check — the two would then disagree
    // by the overshoot amount and the balance invariant
    // (hoursRemaining === starting - spent - hoursDrained + hoursEarned)
    // would break. Capping here means hoursDrained only ever records hours
    // the player actually had to lose.
    const delta = Math.min(rawDelta, Math.max(0, next.hoursRemaining));

    next = {
      ...next,
      // drainApplied advances by the CLAMPED delta so it stays in lockstep
      // with what the balance actually lost (see the clamp note above).
      activeShift: { ...updatedShift, drainApplied: originalShift.drainApplied + delta },
      hoursRemaining: next.hoursRemaining - delta,
      hoursDrained: next.hoursDrained + delta,
    };
  }

  // --- Step 2: death mid-shift. Wage is never paid. Return immediately. ---
  if (next.activeShift && next.hoursRemaining <= 0) {
    return {
      ...next,
      status: 'dead',
      hoursRemaining: 0,
      activeShift: null,
      endedAt: now,
    };
  }

  // --- Step 3: shift completion. -------------------------------------------
  if (next.activeShift) {
    const progress = shiftProgress(next.activeShift, now, config);
    if (progress.complete) {
      next = {
        ...next,
        hoursRemaining: next.hoursRemaining + next.activeShift.wage,
        hoursEarned: next.hoursEarned + next.activeShift.wage,
        shiftsWorked: next.shiftsWorked + 1,
        activeShift: null,
      };
    }
  }

  // --- Step 4: sale expiry. -------------------------------------------------
  if (next.activeSale && now >= next.activeSale.endsAt) {
    next = { ...next, activeSale: null };
  }

  // --- Step 5: sale roll. ----------------------------------------------------
  if (!next.activeSale && now >= next.nextSaleAt) {
    next = startSale(next, now, rand, config);
  }

  // --- Steps 6 + 7: release roll, then victory check. -----------------------
  //
  // `hasWon` is evaluated on `next` BEFORE the release step runs. A release
  // only ever grows the available-games denominator, so by itself it can
  // never create a win. But if the player already owned everything entering
  // this step, a release must not be allowed to land in the same tick —
  // per spec Edge Cases: "A new game releases at the same moment the player
  // owns everything: the victory check resolves first, so the player is not
  // robbed of a win by a race." So: if already won, skip the release
  // entirely and resolve the win; otherwise roll the release normally and
  // check for a win afterward (which a release cannot itself trigger, but
  // this keeps steps 6/7 in the order the contract specifies).
  const alreadyWon = hasWon(next);
  if (alreadyWon) {
    next = { ...next, status: 'won', activeShift: null, endedAt: now };
  } else {
    if (now >= next.nextReleaseAt) {
      next = rollRelease(next, now, rand, config);
    }
    if (hasWon(next)) {
      next = { ...next, status: 'won', activeShift: null, endedAt: now };
    }
  }

  return next;
}

// ---------------------------------------------------------------------------
// DISMISS_ANNOUNCEMENT / SET_STOREFRONT / RESTART
// ---------------------------------------------------------------------------

function dismissAnnouncement(
  state: RunState,
  action: Extract<GameAction, { type: 'DISMISS_ANNOUNCEMENT' }>,
): RunState {
  if (!state.announcements.some((a) => a.id === action.id)) return state;
  return { ...state, announcements: state.announcements.filter((a) => a.id !== action.id) };
}

function setStorefront(
  state: RunState,
  action: Extract<GameAction, { type: 'SET_STOREFRONT' }>,
): RunState {
  // UI-only navigation: no status gate, never touches balance, library, or
  // the shift (FR-007) — a shift keeps running across every navigation.
  if (state.activeStorefrontId === action.storefrontId) return state;
  return { ...state, activeStorefrontId: action.storefrontId };
}

// ---------------------------------------------------------------------------
// Reducer entry point
// ---------------------------------------------------------------------------

export function gameReducer(state: RunState, action: GameAction, config: Config): RunState {
  switch (action.type) {
    case 'BUY':
      return buy(state, action, config);
    case 'START_SHIFT':
      return startShift(state, action, config);
    case 'SOLVE_PUZZLE':
      return solvePuzzle(state, action);
    case 'SET_SPACING_OUT':
      return setSpacingOut(state, action);
    case 'TICK':
      return tick(state, action, config);
    case 'DISMISS_ANNOUNCEMENT':
      return dismissAnnouncement(state, action);
    case 'SET_STOREFRONT':
      return setStorefront(state, action);
    case 'DISMISS_WELCOME':
      return state.welcomeSeen ? state : { ...state, welcomeSeen: true };

    case 'RESTART':
      // Carry welcomeSeen across a restart: the player has already read the
      // rules, and re-showing a wall of text every time they start another
      // life would be tedious rather than atmospheric.
      return { ...initialRun(action.now, config), welcomeSeen: state.welcomeSeen };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
