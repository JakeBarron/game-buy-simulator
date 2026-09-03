// Hidden true value and collection scoring for Game Buy Simulator.
//
// See specs (Task 3): the crowd's `marketRating` (catalogue.ts) is what the store shows;
// `trueValue` is what a game is *actually* worth, rolled once per run and never shown for an
// unowned game. The gap between the two is the whole speculation loop — a hidden gem clears
// its market rating, a trap falls short of it.
//
// PURITY: no React, no Date.now(), no Math.random(), no storage. Randomness always arrives as
// an injected `rand: () => number` so a run's rolls are reproducible and testable.

import type { Game, GameTrait, Review, ReviewSentiment, RunState } from './types';

// ---------------------------------------------------------------------------
// Scoring curve
// ---------------------------------------------------------------------------

/**
 * Points per true-value star. Deliberately exponential (roughly x2.3-x2.5 per star) so that
 * one 5-star hidden gem is worth more than a shelf of 1-star shovelware — quality beats
 * quantity, and hoovering up cheap junk is never the optimal strategy.
 */
export const SCORE_CURVE: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 1,
  2: 3,
  3: 8,
  4: 20,
  5: 50,
};

/** Points contributed by owning a game whose rolled true value is `trueValue`. */
export function scoreForValue(trueValue: number): number {
  const clamped = Math.min(5, Math.max(1, Math.round(trueValue))) as 1 | 2 | 3 | 4 | 5;
  return SCORE_CURVE[clamped];
}

// ---------------------------------------------------------------------------
// True value roll
// ---------------------------------------------------------------------------

/**
 * How far a trait shifts the roll's centre away from `marketRating`, in star-units. Positive
 * shifts the centre up (more likely to roll higher than the crowd thinks); negative shifts it
 * down. `early-access` contributes 0 here — its effect is variance, handled by DECAY below,
 * not a directional shift. `grind` and `prestige` are neutral by design (0).
 *
 * Magnitudes are tuned (and regression-tested in valuation.test.ts) so that, at a mid-range
 * market rating, the biased mean clears the "meaningfully" and "strictly above/below" bars
 * required by the design without ever making the shift a certainty — the underlying kernel
 * (see DEFAULT_DECAY) keeps every value 1-5 possible regardless of shift size.
 */
const TRAIT_CENTER_BIAS: Record<GameTrait, number> = {
  cult: 0.85,
  contemplative: 0.65,
  hype: -0.85,
  'annual-sequel': -0.65,
  'asset-flip': -1.2,
  'early-access': 0,
  grind: 0,
  prestige: 0,
};

/** Safety rail on the summed bias of a multi-trait game — keeps the shift a tendency, never a
 *  wall. No game in the current catalogue sums past this, but a future one might. */
const MAX_ABS_CENTER_SHIFT = 3;

/**
 * Base spread of the roll around its (possibly shifted) centre. Applied as `DECAY ** distance`,
 * so smaller values concentrate probability tighter around the centre and larger values spread
 * it out. 0.45 keeps a neutral game's mean close to its market rating while still leaving every
 * value reachable.
 */
const DEFAULT_DECAY = 0.45;

/** `early-access` games are flagged as "high variance in both directions" — a much flatter
 *  kernel achieves that without touching the centre. */
const EARLY_ACCESS_DECAY = 0.8;

const TRUE_VALUES = [1, 2, 3, 4, 5] as const;

/**
 * Weighted-random pick of one index from `weights` (all >= 0, at least one > 0), consuming
 * exactly one `rand()` draw. Shared by the true-value roll and review selection below so both
 * draw from the same kind of discrete distribution.
 */
function weightedPickIndex(weights: number[], rand: () => number): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  // Floating-point tail (roll never quite reaches 0 due to rounding): last non-zero weight.
  for (let i = weights.length - 1; i >= 0; i--) {
    if (weights[i] > 0) return i;
  }
  return weights.length - 1;
}

/**
 * Draws this game's hidden true value (1-5) for one run. Centred on `marketRating` — the
 * crowd is usually roughly right — then the centre is shifted by the sum of its traits'
 * `TRAIT_CENTER_BIAS`. `asset-flip` additionally has its value-5 weight forced to 0, so it can
 * never roll a perfect score no matter how the dice land.
 */
export function rollTrueValue(game: Game, rand: () => number): number {
  let centerShift = 0;
  let decay = DEFAULT_DECAY;
  for (const trait of game.traits) {
    centerShift += TRAIT_CENTER_BIAS[trait];
    if (trait === 'early-access') decay = Math.max(decay, EARLY_ACCESS_DECAY);
  }
  centerShift = Math.max(-MAX_ABS_CENTER_SHIFT, Math.min(MAX_ABS_CENTER_SHIFT, centerShift));

  const center = game.marketRating + centerShift;
  const forbidFive = game.traits.includes('asset-flip');

  const weights = TRUE_VALUES.map((value) => {
    if (forbidFive && value === 5) return 0;
    return decay ** Math.abs(value - center);
  });

  const index = weightedPickIndex(weights, rand);
  return TRUE_VALUES[index];
}

/** Rolls every game's true value once. Called exactly once per run, at run start. */
export function rollAllTrueValues(games: Game[], rand: () => number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const game of games) {
    result[game.id] = rollTrueValue(game, rand);
  }
  return result;
}

/**
 * Sum of `scoreForValue` over every owned game, plus each game's accumulated early-adopter
 * bonus (Task 5) — a game's contribution is its curve value PLUS whatever conviction bonus it
 * has banked, not just the curve. `earlyAdopterBonuses` defaults to empty so pre-Task-5 callers
 * (and every existing test) keep working unchanged. 0 for an empty collection.
 */
export function collectionScore(
  ownedGameIds: string[],
  trueValues: Record<string, number>,
  earlyAdopterBonuses: Record<string, number> = {},
): number {
  return ownedGameIds.reduce((sum, id) => {
    const trueValue = trueValues[id];
    if (trueValue === undefined) return sum;
    return sum + scoreForValue(trueValue) + (earlyAdopterBonuses[id] ?? 0);
  }, 0);
}

// ---------------------------------------------------------------------------
// Review selection
// ---------------------------------------------------------------------------

/** Scale a review's sentiment onto the same 1-5 axis as true value, so "how well does this
 *  review's sentiment match the rolled true value" is just a distance. */
const SENTIMENT_SCORE: Record<ReviewSentiment, number> = {
  damning: 1,
  negative: 2,
  mixed: 3,
  positive: 4,
  glowing: 5,
};

const SENTIMENT_BY_SCORE: Record<number, ReviewSentiment> = {
  1: 'damning',
  2: 'negative',
  3: 'mixed',
  4: 'positive',
  5: 'glowing',
};

/** How tightly review selection skews toward the sentiment matching the rolled true value. */
const SENTIMENT_DECAY = 0.5;

function sentimentWeight(sentiment: ReviewSentiment, trueValue: number): number {
  return SENTIMENT_DECAY ** Math.abs(SENTIMENT_SCORE[sentiment] - trueValue);
}

/**
 * Picks which `count` reviews from `game`'s authored pool are shown this run, skewed toward
 * sentiments matching `trueValue` (a game that rolled high shows more of its glowing reviews).
 *
 * This always leaves at least one off-sentiment review in the result when the pool has one
 * available — that's the noise that makes reviews a real tell rather than a readout. Without
 * it, a sharp player could read the display exactly like a true-value readout instead of odds.
 */
export function selectReviews(
  game: Game,
  trueValue: number,
  rand: () => number,
  count: number,
): Review[] {
  const pool = game.reviews;
  const n = Math.max(0, Math.min(count, pool.length));
  if (n === 0) return [];

  const ideal = SENTIMENT_BY_SCORE[Math.min(5, Math.max(1, Math.round(trueValue)))];

  // Weighted sample without replacement: repeatedly pick from what's left.
  const remaining = pool.map((review, i) => ({ review, i }));
  const selected: { review: Review; i: number }[] = [];
  for (let k = 0; k < n; k++) {
    const weights = remaining.map((item) => sentimentWeight(item.review.sentiment, trueValue));
    const pickIndex = weightedPickIndex(weights, rand);
    selected.push(remaining[pickIndex]);
    remaining.splice(pickIndex, 1);
  }

  // Guarantee noise: if nothing off-sentiment made it in, force-swap one in for the selected
  // review that currently matches the ideal sentiment most strongly.
  const hasOffSentiment = selected.some((item) => item.review.sentiment !== ideal);
  if (!hasOffSentiment) {
    const offCandidates = remaining.filter((item) => item.review.sentiment !== ideal);
    if (offCandidates.length > 0) {
      const offWeights = offCandidates.map((item) =>
        sentimentWeight(item.review.sentiment, trueValue),
      );
      const chosen = offCandidates[weightedPickIndex(offWeights, rand)];

      let swapOutIndex = 0;
      let bestWeight = -Infinity;
      selected.forEach((item, idx) => {
        const w = sentimentWeight(item.review.sentiment, trueValue);
        if (w > bestWeight) {
          bestWeight = w;
          swapOutIndex = idx;
        }
      });
      selected[swapOutIndex] = chosen;
    }
  }

  return selected.map((item) => item.review);
}

// ---------------------------------------------------------------------------
// Re-appraisal (Task 5): the crowd changes its mind mid-run.
// ---------------------------------------------------------------------------
//
// A re-appraisal moves BOTH the visible marketRating and the hidden trueValue of one game by 1,
// in the same direction, clamped to 1-5. Direction is trait-weighted the same way the initial
// true-value roll is trait-biased (see TRAIT_CENTER_BIAS above): cult/contemplative games skew
// toward being re-rated UP, hype/annual-sequel toward DOWN, early-access swings hard either way,
// and asset-flip (already capped at 4 by the initial roll) leans down but isn't locked out of
// recovering. grind/prestige stay neutral, same as in the initial roll.

export type ReappraisalDirection = 'up' | 'down';

/**
 * Directional pull per trait, as a weight ABOVE the neutral baseline of 1 (mirrors
 * TRAIT_CENTER_BIAS's additive-sum style, just multiplicative-flavoured): a game's weight for
 * a direction is `1 + sum(REAPPRAISAL_TRAIT_WEIGHT[trait][direction] - 1)` over its traits, so a
 * trait-less game gets exactly 1 or an even multi-trait game gets a nudged sum without ever
 * requiring a single trait to double-count against the baseline.
 */
const REAPPRAISAL_TRAIT_WEIGHT: Record<GameTrait, { up: number; down: number }> = {
  cult: { up: 3, down: 0.4 },
  contemplative: { up: 2.2, down: 0.5 },
  hype: { up: 0.4, down: 3 },
  'annual-sequel': { up: 0.5, down: 2.2 },
  'asset-flip': { up: 0.5, down: 1.6 },
  'early-access': { up: 1.8, down: 1.8 },
  grind: { up: 1, down: 1 },
  prestige: { up: 1, down: 1 },
};

/** Floor so a heavily-opposed trait combination never zeroes a direction out entirely — it
 *  should be rare, not impossible. */
const MIN_REAPPRAISAL_WEIGHT = 0.05;

function reappraisalDirectionWeight(game: Game, direction: ReappraisalDirection): number {
  let weight = 1;
  for (const trait of game.traits) {
    weight += REAPPRAISAL_TRAIT_WEIGHT[trait][direction] - 1;
  }
  return Math.max(weight, MIN_REAPPRAISAL_WEIGHT);
}

/**
 * A game's total pull toward being THIS event's target, regardless of which way it would move —
 * the sum of both directions' weight, with a direction's contribution zeroed out once its true
 * value has already reached the boundary it would move toward (a 5 can't go up; a 1 can't go
 * down). A game at neither boundary is eligible either way and gets both weights summed, which is
 * why a cult game (heavily up-weighted, lightly down-weighted) still shows up reasonably often —
 * just mostly to be moved up.
 */
function reappraisalSelectionWeight(game: Game, trueValue: number): number {
  const upWeight = trueValue < 5 ? reappraisalDirectionWeight(game, 'up') : 0;
  const downWeight = trueValue > 1 ? reappraisalDirectionWeight(game, 'down') : 0;
  return upWeight + downWeight;
}

/**
 * Chooses which game gets re-appraised this event, weighted by trait (see above) and excluding
 * any game with no trueValue on record. Returns null only when `games` yields no eligible
 * candidate at all (e.g. an empty list) — in practice, with more than one value 1-5 in play,
 * there is always at least one direction open for every game, so this is mostly a defensive
 * fallback rather than something a real run hits.
 */
export function pickReappraisalTarget(
  state: Pick<RunState, 'trueValues'>,
  games: Game[],
  rand: () => number,
): string | null {
  const eligible: Game[] = [];
  const weights: number[] = [];
  for (const game of games) {
    const trueValue = state.trueValues[game.id];
    if (trueValue === undefined) continue;
    const weight = reappraisalSelectionWeight(game, trueValue);
    if (weight <= 0) continue;
    eligible.push(game);
    weights.push(weight);
  }
  if (eligible.length === 0) return null;

  const index = weightedPickIndex(weights, rand);
  return eligible[index].id;
}

/**
 * Moves `currentTrueValue` and `currentMarketRating` by 1 in the same direction, clamped to 1-5.
 * Direction is forced when the game's true value already sits at the boundary that direction
 * would move toward (never rolls a no-op "up" for a value-5 game); otherwise it's a trait-weighted
 * coin flip via `reappraisalDirectionWeight`, consuming exactly one `rand()` draw. When only the
 * true value is at a boundary but the market rating isn't (or vice versa), the market rating
 * still gets clamped independently — the two need not have started at the same star.
 */
export function applyReappraisal(
  game: Game,
  currentTrueValue: number,
  currentMarketRating: number,
  rand: () => number,
): { direction: ReappraisalDirection; newTrueValue: number; newMarketRating: number } {
  const canGoUp = currentTrueValue < 5;
  const canGoDown = currentTrueValue > 1;

  let direction: ReappraisalDirection;
  if (canGoUp && canGoDown) {
    const upWeight = reappraisalDirectionWeight(game, 'up');
    const downWeight = reappraisalDirectionWeight(game, 'down');
    direction = rand() * (upWeight + downWeight) < upWeight ? 'up' : 'down';
  } else if (canGoUp) {
    direction = 'up';
  } else {
    // canGoDown must be true here: a value already clamped to 1-5 always has at least one
    // direction open (a value can only fail both canGoUp and canGoDown if it's simultaneously
    // >=5 and <=1, which is impossible).
    direction = 'down';
  }

  const delta = direction === 'up' ? 1 : -1;
  const clamp = (v: number) => Math.min(5, Math.max(1, v + delta));
  return {
    direction,
    newTrueValue: clamp(currentTrueValue),
    newMarketRating: clamp(currentMarketRating),
  };
}

/**
 * The early-adopter payoff: 2x (config.EARLY_ADOPTER_MULTIPLIER) on the GAIN from an upward
 * re-appraisal, not on the whole curve value — a 3->4 move (curve 8->20, gain 12) credits an
 * owner 12 EXTRA points (on top of the 12 the curve already gives via the updated trueValue),
 * for 24 total effective gain, never the naive-and-wrong "double the new score" (40). Returns 0
 * whenever the game wasn't owned at the time, or the move wasn't a gain (a downward
 * re-appraisal, or — defensively — any non-positive delta).
 */
export function earlyAdopterBonus(
  oldTrueValue: number,
  newTrueValue: number,
  owned: boolean,
  multiplier: number,
): number {
  if (!owned) return 0;
  const gain = scoreForValue(newTrueValue) - scoreForValue(oldTrueValue);
  if (gain <= 0) return 0;
  return gain * (multiplier - 1);
}
