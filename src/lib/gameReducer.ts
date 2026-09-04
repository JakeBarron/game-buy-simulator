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

import type {
  RunState, GameAction, Shift, Sale, Announcement, PurchaseRecord, Listing, Review,
  ReappraisalHistoryEntry,
} from './types';
import type { Config, Range } from './config';
import { shiftProgress, shiftDrain, accrueBonus } from './timeEngine';
import {
  currentPrice, discountFor, isOwned, isPricedOut, availableListings, availableGameIds, gameById,
  effectiveMarketRating,
} from './economy';
import {
  rollAllTrueValues, selectReviews, pickReappraisalTarget, applyReappraisal, earlyAdopterBonus,
} from './valuation';
import { GAMES, LISTINGS, STOREFRONTS, SALE_NAMES } from '../data/catalogue';
import { checkAnswer } from './puzzles';

const LISTINGS_BY_ID = new Map<string, Listing>(LISTINGS.map((l) => [l.id, l]));

/** How many of a game's authored reviews are on display for the run. Matches what the card UI
 *  shows (GameCard) — kept here, next to the roll, rather than duplicated at the call site. */
const DISPLAYED_REVIEWS_COUNT = 3;

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

/**
 * Weight a listing inversely to its game's marketRating: a 5* game is
 * markedly less likely to be chosen for a sale than a 1* game. Squaring the
 * (6 - rating) spread makes that skew pronounced rather than mild — a 1*
 * game is 25x as likely to be picked as a 5* game, all else equal.
 *
 * Uses `effectiveMarketRating`, not the raw catalogue value — a re-appraisal (Task 5) changes
 * what the crowd currently thinks, and sale weighting must react to that.
 */
function saleWeightFor(listing: Listing, state: RunState): number {
  return (6 - effectiveMarketRating(state, listing.gameId)) ** 2;
}

/**
 * Weighted shuffle without replacement (Efraimidis-Spirakis A-Res): each
 * item gets a key of log(rand()) / weight, and sorting descending by that
 * key yields a random ordering where higher-weight items tend to sort
 * first — without ever drawing an item twice. Taking the top N of the
 * result is then a weighted sample of N distinct items. Entirely driven by
 * the injected `rand`, so it stays deterministic/replayable like every
 * other roll in this file.
 */
function weightedShuffle<T>(items: T[], weightOf: (item: T) => number, rand: () => number): T[] {
  return items
    .map((item) => {
      const weight = Math.max(weightOf(item), 1e-9);
      const u = Math.max(rand(), 1e-9); // avoid log(0) = -Infinity
      return { item, key: Math.log(u) / weight };
    })
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function initialRun(now: number, config: Config, rand: () => number): RunState {
  // Rolled ONCE, here, for every game in the catalogue (including unreleased release-pool
  // games, so they already have a stable value/review-selection the moment they land
  // mid-run). Both persist verbatim in RunState — see storage.ts and the schema-version bump
  // in config.ts — so a reload replays the same run rather than rerolling every bet the player
  // has made.
  const trueValues = rollAllTrueValues(GAMES, rand);
  const displayedReviews: Record<string, Review[]> = {};
  for (const game of GAMES) {
    displayedReviews[game.id] = selectReviews(
      game,
      trueValues[game.id],
      rand,
      DISPLAYED_REVIEWS_COUNT,
    );
  }

  return {
    schemaVersion: config.SCHEMA_VERSION,
    status: 'playing',
    hoursRemaining: config.STARTING_HOURS,
    startedAt: now,
    ownedGameIds: [],
    trueValues,
    displayedReviews,
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
    nextReappraisalAt: now + rangeMid(config.REAPPRAISAL_INTERVAL_MS),
    marketRatingOverrides: {},
    earlyAdopterBonuses: {},
    reappraisalHistory: [],
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

  const price = currentPrice(listing, state.activeSale, action.now - state.startedAt, config);
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
  // priced-out when a purchase spends the player's exact last hours on the
  // final unowned game (balance hits 0 counts as game over per spec Edge
  // Cases). Buying the last available game also empties the unowned set,
  // which isPricedOut treats as game over too (see its null-price branch) —
  // the catalogue-exhausted ending.
  if (next.hoursRemaining <= 0) {
    next = { ...next, status: 'dead', hoursRemaining: 0, activeShift: null, endedAt: action.now };
  } else if (isPricedOut(next, action.now - next.startedAt, config)) {
    // A shift still running when the run ends stops immediately (spec Edge
    // Cases, carried over from the old victory check) — applies here too.
    next = { ...next, status: 'pricedOut', activeShift: null, endedAt: action.now };
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

  // Weighted, not uniform: highly-rated games go on sale less often (see
  // saleWeightFor).
  const weighted = weightedShuffle(listings, (listing) => saleWeightFor(listing, state), rand);
  const fraction = pickInRange(rand, config.SALE_LISTING_FRACTION);
  const count = Math.min(weighted.length, Math.max(1, Math.round(weighted.length * fraction)));
  const chosen = weighted.slice(0, count);

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

/**
 * Toast copy for a re-appraisal, in the project's dry deadpan voice. Reads differently along
 * two independent axes — owned vs. unowned, up vs. down — so all four cells get their own line
 * (Task 5, Part C) rather than one templated sentence with a swapped verb:
 *   - owned + up: triumphant, names the bonus.
 *   - owned + down: grim — a depreciating asset, no bonus to soften it.
 *   - unowned + up: the one that hurts — passed on it, and it just got pricier.
 *   - unowned + down: quietly satisfying — dodged that.
 */
function reappraisalText(
  title: string,
  direction: 'up' | 'down',
  owned: boolean,
  bonus: number,
): string {
  if (owned && direction === 'up') {
    return `${title} just got re-rated up. You already own it. +${bonus} pts.`;
  }
  if (owned && direction === 'down') {
    return `${title} just got re-rated down. You already own it.`;
  }
  if (!owned && direction === 'up') {
    return `${title} just got re-rated up. You passed. It's pricier now.`;
  }
  return `${title} just got re-rated down. Good thing you skipped it.`;
}

function rollReappraisal(state: RunState, now: number, rand: () => number, config: Config): RunState {
  const nextReappraisalAt = now + pickInRange(rand, config.REAPPRAISAL_INTERVAL_MS);

  // Only games the player can currently see are eligible — re-appraising a game still sitting
  // in the release pool would move numbers nobody can observe yet and could announce a title
  // that hasn't "released" in-fiction.
  const availableIds = new Set(availableGameIds(state));
  const available = GAMES.filter((g) => availableIds.has(g.id));
  const targetId = pickReappraisalTarget(state, available, rand);
  if (!targetId) {
    return { ...state, nextReappraisalAt };
  }

  const game = gameById(targetId);
  if (!game) return { ...state, nextReappraisalAt };

  const oldTrueValue = state.trueValues[targetId];
  const oldMarketRating = state.marketRatingOverrides[targetId] ?? game.marketRating;
  const { direction, newTrueValue, newMarketRating } = applyReappraisal(
    game,
    oldTrueValue,
    oldMarketRating,
    rand,
  );

  const owned = isOwned(state, targetId);
  const bonus = earlyAdopterBonus(oldTrueValue, newTrueValue, owned, config.EARLY_ADOPTER_MULTIPLIER);
  const earlyAdopterBonuses = bonus > 0
    ? { ...state.earlyAdopterBonuses, [targetId]: (state.earlyAdopterBonuses[targetId] ?? 0) + bonus }
    : state.earlyAdopterBonuses;

  const historyEntry: ReappraisalHistoryEntry = {
    gameId: targetId,
    direction,
    oldTrueValue,
    newTrueValue,
    oldMarketRating,
    newMarketRating,
    owned,
    at: now,
  };

  const announcement: Announcement = {
    id: `announce-reappraisal-${targetId}-${now}`,
    kind: 'reappraisal',
    text: reappraisalText(game.title, direction, owned, bonus),
    expiresAt: now + config.ANNOUNCEMENT_MS,
    reappraisal: { owned, direction },
  };

  return {
    ...state,
    trueValues: { ...state.trueValues, [targetId]: newTrueValue },
    marketRatingOverrides: { ...state.marketRatingOverrides, [targetId]: newMarketRating },
    earlyAdopterBonuses,
    reappraisalHistory: [...state.reappraisalHistory, historyEntry],
    nextReappraisalAt,
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

  // --- Steps 6-8: release roll, re-appraisal roll, then priced-out check. ---
  //
  // Release runs FIRST, then isPricedOut is evaluated on the result. Unlike
  // the old victory check, a release here can genuinely save the player: it
  // grows the unowned set, which can only lower cheapestUnownedPrice, so
  // rolling it before the check gives a same-tick release its full chance
  // to pull the player back from the brink rather than being robbed of a
  // lifeline by ordering. Death-by-drain (step 2) still takes precedence
  // over this and still pays no wage.
  if (now >= next.nextReleaseAt) {
    next = rollRelease(next, now, rand, config);
  }

  // Re-appraisal (Task 5) also runs before the priced-out check, for the same reason: it must
  // never be robbed of visibility by ordering. A re-appraisal doesn't change affordability the
  // way a release can (marketRating/trueValue don't feed isPricedOut), so it can't rescue a run
  // the way a release can — but placing it here still guarantees that a re-appraisal firing on
  // the very tick the run ends is recorded and announced in the resulting terminal state, rather
  // than being computed against a state that's already moved on.
  if (now >= next.nextReappraisalAt) {
    next = rollReappraisal(next, now, rand, config);
  }

  if (isPricedOut(next, now - next.startedAt, config)) {
    next = { ...next, status: 'pricedOut', activeShift: null, endedAt: now };
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
      // life would be tedious rather than atmospheric. Everything else,
      // including trueValues/displayedReviews, is rerolled fresh — a new run
      // is a new set of bets.
      return { ...initialRun(action.now, config, action.rand), welcomeSeen: state.welcomeSeen };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
