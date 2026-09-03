// Pure derived-value helpers for Game Buy Simulator.
// See specs/001-game-buy-simulator/data-model.md ("Derived values" section).
//
// Everything here is a pure function: no React, no Date.now(), no
// Math.random(), no localStorage. Any `now` or `config` the logic needs is
// passed in by the caller.

import { GAMES, LISTINGS, STOREFRONTS } from '../data/catalogue';
import { restingShiftDrain, spacedShiftDrain, type Config } from './config';
import { inflatedPrice } from './inflation';
import type { Game, Listing, RunState, Sale, Storefront } from './types';

// ---------------------------------------------------------------------------
// Catalogue lookups
// ---------------------------------------------------------------------------

const GAMES_BY_ID = new Map<string, Game>(GAMES.map((g) => [g.id, g]));
const STOREFRONTS_BY_ID = new Map<string, Storefront>(STOREFRONTS.map((s) => [s.id, s]));

export function gameById(gameId: string): Game | undefined {
  return GAMES_BY_ID.get(gameId);
}

export function storefrontById(id: string): Storefront | undefined {
  return STOREFRONTS_BY_ID.get(id);
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/** Percent off a listing under the active sale; 0 when the listing has no discount. */
export function discountFor(listing: Listing, sale: Sale | null): number {
  if (!sale) return 0;
  return sale.discounts[listing.id] ?? 0;
}

/**
 * Effective price for a listing at `elapsedMs` (ms since the run started)
 * under the active sale.
 *
 * MUST compose in this order: base listing price -> inflation -> sale
 * discount -> MIN_PRICE floor. Inflation applies to the base price and the
 * discount applies to the ALREADY-INFLATED price, so a percentage off is
 * worth more later in the run in absolute terms — sales stay genuinely
 * attractive as the run goes on rather than eroding in value. Every price
 * path in the app goes through this one function; there must be no second
 * path that charges an un-inflated price. (Pass `sale: null` for the
 * discount-free inflated price alone — cheapestUnownedPrice below does
 * exactly that rather than duplicating the inflation lookup.)
 */
export function currentPrice(
  listing: Listing,
  sale: Sale | null,
  elapsedMs: number,
  config: Config,
): number {
  const storefront = storefrontById(listing.storefrontId);
  if (!storefront) {
    // Every listing's storefrontId is asserted to resolve to a real
    // storefront (catalogue.test.ts, "keeps every listing id in sync with
    // its storefront/game and both real"), and every Storefront now
    // carries a required `inflationRate` — there is no legitimate way to
    // land here. Throwing surfaces that data-integrity bug immediately
    // instead of a silent `?? 1` fallback quietly mispricing a listing.
    throw new Error(
      `currentPrice: listing '${listing.id}' references unknown storefront '${listing.storefrontId}'`,
    );
  }
  const inflated = inflatedPrice(listing.price, elapsedMs, storefront.inflationRate, config);

  const percent = discountFor(listing, sale);
  if (percent <= 0) return inflated;

  const discounted = Math.round(inflated * (1 - percent / 100));
  return Math.max(config.MIN_PRICE, discounted);
}

// ---------------------------------------------------------------------------
// Ownership / affordability
// ---------------------------------------------------------------------------

/** Game-level, not listing-level: owning a game on one storefront owns it everywhere. */
export function isOwned(state: RunState, gameId: string): boolean {
  return state.ownedGameIds.includes(gameId);
}

/** No overdraft is ever permitted: strictly price <= hoursRemaining. */
export function canAfford(state: RunState, price: number): boolean {
  return price <= state.hoursRemaining;
}

// ---------------------------------------------------------------------------
// Availability (starting catalogue + released games)
// ---------------------------------------------------------------------------

/**
 * Every game currently available: the starting catalogue (games without
 * `releasePool`) plus any release-pool games that have landed. This is the
 * denominator for the win condition, and it grows over the run.
 */
export function availableGameIds(state: RunState): string[] {
  const starting = GAMES.filter((g) => !g.releasePool).map((g) => g.id);
  return [...starting, ...state.releasedGameIds];
}

export function availableListings(state: RunState): Listing[] {
  const available = new Set(availableGameIds(state));
  return LISTINGS.filter((l) => available.has(l.gameId));
}

export function listingsForStorefront(state: RunState, storefrontId: string): Listing[] {
  return availableListings(state).filter((l) => l.storefrontId === storefrontId);
}

/**
 * Owned vs. available counts. Used to detect a fully-exhausted catalogue —
 * `owned === available && available > 0` — which is one of the two ways a
 * run ends in being priced out (see isPricedOut / the EndScreen's distinct
 * "nothing left to buy" copy).
 */
export function collectionProgress(state: RunState): { owned: number; available: number } {
  const available = availableGameIds(state);
  const owned = available.filter((id) => isOwned(state, id)).length;
  return { owned, available: available.length };
}

/**
 * Cheapest inflated price, at `elapsedMs`, across every currently-available
 * UNOWNED listing — the number that decides whether the player has anything
 * left they could still work toward. Ignores any active sale (passes
 * `sale: null` to currentPrice): sales are transient and this is used to
 * reason about prices at a FUTURE point in time (see isPricedOut), where no
 * sale can be assumed. Returns null when there is no unowned listing left
 * at all (the catalogue is exhausted).
 */
export function cheapestUnownedPrice(
  state: RunState,
  elapsedMs: number,
  config: Config,
): number | null {
  const unowned = availableListings(state).filter((l) => !isOwned(state, l.gameId));
  if (unowned.length === 0) return null;

  let min = Infinity;
  for (const listing of unowned) {
    const price = currentPrice(listing, null, elapsedMs, config);
    if (price < min) min = price;
  }
  return min;
}

/**
 * The run is over not merely because the player is broke right now — they
 * can still work — but when even ONE MORE full shift would not be enough.
 * Concretely: hoursRemaining plus the net of one more resting shift (wage
 * minus its drain) is compared against the cheapest unowned price as it
 * will be once that shift finishes (elapsedMs + WORK_REQUIRED_MS). If that
 * projected balance still falls short, the player is priced out. A fully
 * exhausted catalogue (cheapestUnownedPrice === null — nothing left to buy,
 * ever) also ends the run.
 */
export function isPricedOut(state: RunState, elapsedMs: number, config: Config): boolean {
  const priceAfterOneMoreShift = cheapestUnownedPrice(
    state,
    elapsedMs + config.WORK_REQUIRED_MS,
    config,
  );
  if (priceAfterOneMoreShift === null) return true;

  const projectedHours = state.hoursRemaining + (config.WAGE - restingShiftDrain(config));
  return projectedHours < priceAfterOneMoreShift;
}

// ---------------------------------------------------------------------------
// Shift economics
// ---------------------------------------------------------------------------

export function restingShiftCost(config: Config): number {
  return restingShiftDrain(config);
}

export function spacedShiftCost(config: Config): number {
  return spacedShiftDrain(config);
}

/** Whether the player has enough hours to survive a shift worked entirely at rest. */
export function canSurviveRestingShift(state: RunState, config: Config): boolean {
  return state.hoursRemaining > restingShiftDrain(config);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function totalHoursSpent(state: RunState): number {
  return state.history.reduce((sum, record) => sum + record.pricePaid, 0);
}

export function runStats(
  state: RunState,
  now: number,
): {
  gamesOwned: number;
  hoursSpent: number;
  shiftsWorked: number;
  hoursDrained: number;
  hoursEarned: number;
  runDurationMs: number;
} {
  return {
    gamesOwned: state.ownedGameIds.length,
    hoursSpent: totalHoursSpent(state),
    shiftsWorked: state.shiftsWorked,
    hoursDrained: state.hoursDrained,
    hoursEarned: state.hoursEarned,
    runDurationMs: (state.endedAt ?? now) - state.startedAt,
  };
}
