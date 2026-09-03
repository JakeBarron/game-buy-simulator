// Tuning constants for Game Buy Simulator.
// See specs/001-game-buy-simulator/data-model.md for the reference values.

// Bumped for Task 5: RunState gained nextReappraisalAt, earlyAdopterBonuses,
// reappraisalHistory, and marketRatingOverrides — an old save doesn't have them.
export const SCHEMA_VERSION = 6;
// Tuned by play (T051). The starting catalogue costs 1253 hours at cheapest
// prices, so the original 1500-hour start let the player buy everything before
// ever working - the loop never engaged. 600 forces work early while leaving
// room to misjudge a shift.
export const STARTING_HOURS = 600;
export const WORK_REQUIRED_MS = 45_000;
/** Hours per ms of work-time at rest -> 270 hours per resting shift. */
export const DRAIN_PER_WORK_MS = 0.001;
/** Work-time advances 3x while spacing out. */
export const SPACE_TIME_MULT = 3;
/** Drain per unit of work-time is 1.5x while spacing out. */
export const SPACE_DRAIN_MULT = 1.5;
export const WAGE = 150;
export const MIN_PRICE = 1;
export const TICK_MS = 100;
export const ANNOUNCEMENT_MS = 6000;
/**
 * Elapsed ms for a store's base inflation to double (`inflationMultiplier` in
 * inflation.ts): 2 ** (storeRate * elapsedMs / INFLATION_DOUBLING_MS). A
 * storefront's `inflationRate` scales the exponent, so a faster store
 * doubles proportionally sooner than this baseline. Task 7 will tune this.
 */
export const INFLATION_DOUBLING_MS = 150_000;

export type Range = { min: number; max: number };

export const SALE_INTERVAL_MS: Range = { min: 60_000, max: 150_000 };
export const SALE_DURATION_MS: Range = { min: 45_000, max: 90_000 };
export const SALE_DISCOUNT_PCT: Range = { min: 15, max: 85 };
/** Fraction of listings discounted. */
export const SALE_LISTING_FRACTION: Range = { min: 0.15, max: 0.45 };
export const RELEASE_INTERVAL_MS: Range = { min: 90_000, max: 210_000 };
/** How often the crowd changes its mind about a game (Task 5). Roughly every 45-90s of run
 *  time — frequent enough that a run sees several, rare enough that each one is an event. */
export const REAPPRAISAL_INTERVAL_MS: Range = { min: 45_000, max: 90_000 };
/**
 * Payoff for conviction (Task 5): applied to the GAIN (not the whole score) when the player
 * already owned a game at the moment it was re-appraised upward — see
 * valuation.earlyAdopterBonus. 2x means a 3->4 move (curve 8->20, gain 12) credits an owner an
 * extra 12 points on top of the 12 the curve already gives them, for 24 total. Task 7's to tune.
 */
export const EARLY_ADOPTER_MULTIPLIER = 2;
/**
 * Franchise-bonus coefficient (Task 6, valuation.franchiseBonus): a fully-owned series of
 * `size` games pays `FRANCHISE_BONUS_COEFFICIENT * size * (size + 1) / 2` — triangular growth,
 * not flat-linear, so a four-game set (10x coefficient) is worth meaningfully more than double a
 * pair (3x coefficient), not just double. Several catalogue titles are the only released entry
 * in their in-fiction franchise (size 1, paying 1x coefficient) — that still pays something, on
 * purpose; the joke is that "completing" some franchises only ever required the one game. Task
 * 7's to tune.
 */
export const FRANCHISE_BONUS_COEFFICIENT = 10;

export type Config = {
  SCHEMA_VERSION: number;
  STARTING_HOURS: number;
  WORK_REQUIRED_MS: number;
  DRAIN_PER_WORK_MS: number;
  SPACE_TIME_MULT: number;
  SPACE_DRAIN_MULT: number;
  WAGE: number;
  MIN_PRICE: number;
  TICK_MS: number;
  ANNOUNCEMENT_MS: number;
  INFLATION_DOUBLING_MS: number;
  SALE_INTERVAL_MS: Range;
  SALE_DURATION_MS: Range;
  SALE_DISCOUNT_PCT: Range;
  SALE_LISTING_FRACTION: Range;
  RELEASE_INTERVAL_MS: Range;
  REAPPRAISAL_INTERVAL_MS: Range;
  EARLY_ADOPTER_MULTIPLIER: number;
  FRANCHISE_BONUS_COEFFICIENT: number;
};

const divideRange = (range: Range, factor: number): Range => ({
  min: range.min / factor,
  max: range.max / factor,
});

/**
 * Builds the tuning config, applying the `?fast` dev override.
 *
 * `?fast` (only outside production) divides ONLY the sale/release interval
 * and duration ranges by 6, so testing doesn't require sitting through
 * multi-minute waits. `WORK_REQUIRED_MS` is deliberately NEVER compressed,
 * in production or development — the shift timer is the feature under test.
 */
export function loadConfig(search: string, isProd: boolean): Config {
  const fast = !isProd && search.includes('fast');
  const factor = fast ? 6 : 1;

  return {
    SCHEMA_VERSION,
    STARTING_HOURS,
    WORK_REQUIRED_MS,
    DRAIN_PER_WORK_MS,
    SPACE_TIME_MULT,
    SPACE_DRAIN_MULT,
    WAGE,
    MIN_PRICE,
    TICK_MS,
    ANNOUNCEMENT_MS,
    INFLATION_DOUBLING_MS,
    SALE_INTERVAL_MS: divideRange(SALE_INTERVAL_MS, factor),
    SALE_DURATION_MS: divideRange(SALE_DURATION_MS, factor),
    SALE_DISCOUNT_PCT,
    SALE_LISTING_FRACTION,
    RELEASE_INTERVAL_MS: divideRange(RELEASE_INTERVAL_MS, factor),
    REAPPRAISAL_INTERVAL_MS: divideRange(REAPPRAISAL_INTERVAL_MS, factor),
    EARLY_ADOPTER_MULTIPLIER,
    FRANCHISE_BONUS_COEFFICIENT,
  };
}

export const CONFIG: Config = loadConfig(
  typeof window !== 'undefined' ? window.location.search : '',
  import.meta.env.PROD,
);

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Total drain (hours) of a shift worked entirely at rest. */
export function restingShiftDrain(c: Config): number {
  return c.DRAIN_PER_WORK_MS * c.WORK_REQUIRED_MS;
}

/**
 * Total drain (hours) of a shift that is spaced out for its entire duration.
 *
 * While spacing out, work-time advances at SPACE_TIME_MULT (3x): each ms of
 * wall time yields 1 baseline ms plus 2 bonus ms, so a fully spaced-out
 * shift covers WORK_REQUIRED_MS of work-time in WORK_REQUIRED_MS/3 of wall
 * time, split as 1/3 baseline work-time and 2/3 bonus work-time. Baseline
 * work-time drains at the resting rate; bonus work-time drains at
 * SPACE_DRAIN_MULT times the resting rate:
 *
 *   drain = DRAIN_PER_WORK_MS * (WORK_REQUIRED_MS / 3)
 *         + SPACE_DRAIN_MULT * DRAIN_PER_WORK_MS * (WORK_REQUIRED_MS * 2 / 3)
 *
 * With the tuned numbers (DRAIN_PER_WORK_MS = 0.001, WORK_REQUIRED_MS =
 * 45_000, SPACE_DRAIN_MULT = 1.5):
 *
 *   baseline = 0.001 * 15_000 = 15
 *   bonus    = 1.5 * 0.001 * 30_000 = 45
 *   total    = 15 + 45 = 60
 *
 * ...against 45 for a resting shift, so zoning out costs a third more for the
 * same 150 wage. (The 270/360 figures in data-model.md were the pre-tuning
 * reference values, kept there as design targets.)
 */
export function spacedShiftDrain(c: Config): number {
  const baselineWorkMs = c.WORK_REQUIRED_MS / 3;
  const bonusWorkMs = (c.WORK_REQUIRED_MS * 2) / 3;
  return (
    c.DRAIN_PER_WORK_MS * baselineWorkMs +
    c.SPACE_DRAIN_MULT * c.DRAIN_PER_WORK_MS * bonusWorkMs
  );
}
