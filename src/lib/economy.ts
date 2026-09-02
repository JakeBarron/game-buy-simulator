// Pure derived-value helpers for Game Buy Simulator.
// See specs/001-game-buy-simulator/data-model.md ("Derived values" section).
//
// Everything here is a pure function: no React, no Date.now(), no
// Math.random(), no localStorage. Any `now` or `config` the logic needs is
// passed in by the caller.

import { GAMES, LISTINGS, STOREFRONTS } from '../data/catalogue';
import { restingShiftDrain, spacedShiftDrain, type Config } from './config';
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
 * Effective price for a listing under the active sale.
 * Rounded to a whole number and clamped to `config.MIN_PRICE` — a price must
 * never be zero or negative, even after a steep discount.
 */
export function currentPrice(listing: Listing, sale: Sale | null, config: Config): number {
  const percent = discountFor(listing, sale);
  if (percent <= 0) return listing.price;
  const discounted = Math.round(listing.price * (1 - percent / 100));
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

export function collectionProgress(state: RunState): { owned: number; available: number } {
  const available = availableGameIds(state);
  const owned = available.filter((id) => isOwned(state, id)).length;
  return { owned, available: available.length };
}

/**
 * Won when every available game is owned. Guarded against `available === 0`
 * so an edge case (e.g. an empty catalogue) can never declare a spurious win.
 */
export function hasWon(state: RunState): boolean {
  const { owned, available } = collectionProgress(state);
  return available > 0 && owned === available;
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
