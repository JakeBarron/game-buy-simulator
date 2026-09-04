// Pure inflation model for Game Buy Simulator.
//
// No React, no Date.now(), no Math.random(), no storage — elapsed time is
// always passed in by the caller (mirrors economy.ts / timeEngine.ts).
//
// Prices rise over the run while the wage stays flat (config.ts WAGE), so
// purchasing power decays. Each storefront compounds at its own rate
// (Storefront.inflationRate in types.ts / catalogue.ts) scaled against a
// shared baseline doubling interval (config.ts INFLATION_DOUBLING_MS) — a
// store with rate 1.0 doubles exactly every INFLATION_DOUBLING_MS; a faster
// store (rate > 1) compounds proportionally sooner, a slower one (rate < 1)
// proportionally later.

import type { Config } from './config';

/**
 * Exponential growth factor for a store's prices at `elapsedMs` since the
 * run started: 2 ** (storeRate * elapsedMs / config.INFLATION_DOUBLING_MS).
 * Exactly 1 at elapsedMs = 0 (no inflation yet) and exactly 2 at
 * elapsedMs = config.INFLATION_DOUBLING_MS when storeRate is 1.0.
 */
export function inflationMultiplier(elapsedMs: number, storeRate: number, config: Config): number {
  return 2 ** ((storeRate * elapsedMs) / config.INFLATION_DOUBLING_MS);
}

/**
 * `basePrice` inflated to `elapsedMs`, rounded to a whole number and clamped
 * to `config.MIN_PRICE` — a price must never be zero or negative, even
 * before any sale discount is applied on top (see economy.ts currentPrice,
 * which composes base price -> inflation (this function) -> sale discount ->
 * MIN_PRICE floor again).
 */
export function inflatedPrice(
  basePrice: number,
  elapsedMs: number,
  storeRate: number,
  config: Config,
): number {
  const raw = basePrice * inflationMultiplier(elapsedMs, storeRate, config);
  return Math.max(config.MIN_PRICE, Math.round(raw));
}
