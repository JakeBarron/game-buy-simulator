import { describe, expect, it } from 'vitest'
import {
  SCORE_CURVE, scoreForValue, rollTrueValue, rollAllTrueValues, collectionScore, selectReviews,
} from './valuation'
import type { Game, Review } from './types'

// Tiny deterministic PRNG (mulberry32) so statistical tests are reproducible and don't rely on
// Math.random — the whole point of injecting `rand` is that the caller controls the sequence.
function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeReview(sentiment: Review['sentiment'], author = sentiment): Review {
  return { sentiment, text: `${sentiment} review`, author }
}

const FULL_POOL: Review[] = [
  makeReview('glowing'),
  makeReview('positive'),
  makeReview('mixed'),
  makeReview('negative'),
  makeReview('damning'),
]

function makeGame(overrides: Partial<Game>): Game {
  return {
    id: 'test-game',
    title: 'Test Game',
    blurb: 'A game for tests.',
    basePrice: 10,
    traits: [],
    marketRating: 3,
    reviewCount: 100,
    reviews: FULL_POOL,
    ...overrides,
  }
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

const SAMPLE_SIZE = 2000

describe('scoreForValue / SCORE_CURVE', () => {
  it('implements exactly 1/3/8/20/50 for true values 1..5', () => {
    expect(SCORE_CURVE).toEqual({ 1: 1, 2: 3, 3: 8, 4: 20, 5: 50 })
    expect(scoreForValue(1)).toBe(1)
    expect(scoreForValue(2)).toBe(3)
    expect(scoreForValue(3)).toBe(8)
    expect(scoreForValue(4)).toBe(20)
    expect(scoreForValue(5)).toBe(50)
  })
})

describe('rollTrueValue determinism', () => {
  it('produces the same rolls for the same seeded rand sequence', () => {
    const game = makeGame({ traits: ['cult'], marketRating: 3 })
    const seq1 = Array.from({ length: 20 }, () => rollTrueValue(game, mulberry32(42)))
    const seq2 = Array.from({ length: 20 }, () => rollTrueValue(game, mulberry32(42)))
    expect(seq1).toEqual(seq2)
  })

  it('is a pure function of the rand sequence: two independently-seeded runs over many games match', () => {
    const games = [
      makeGame({ id: 'a', traits: ['hype'], marketRating: 4 }),
      makeGame({ id: 'b', traits: ['asset-flip'], marketRating: 2 }),
      makeGame({ id: 'c', traits: [], marketRating: 3 }),
    ]
    expect(rollAllTrueValues(games, mulberry32(7))).toEqual(rollAllTrueValues(games, mulberry32(7)))
  })
})

describe('rollTrueValue statistical behaviour (>=2000 rolls, seeded PRNG)', () => {
  it('every trait keeps rolls within 1-5', () => {
    const traitSets: Game['traits'][] = [
      ['cult'], ['contemplative'], ['hype'], ['annual-sequel'], ['asset-flip'],
      ['early-access'], ['grind'], ['prestige'], ['grind', 'hype'], [],
    ]
    for (const traits of traitSets) {
      const game = makeGame({ traits, marketRating: 3 })
      const rand = mulberry32(1234)
      for (let i = 0; i < SAMPLE_SIZE; i++) {
        const v = rollTrueValue(game, rand)
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(5)
        expect(Number.isInteger(v)).toBe(true)
      }
    }
  })

  it('asset-flip games never roll 5, and their mean is below their market rating', () => {
    const game = makeGame({ traits: ['asset-flip'], marketRating: 3 })
    const rand = mulberry32(99)
    const rolls = Array.from({ length: SAMPLE_SIZE }, () => rollTrueValue(game, rand))
    expect(rolls.every((v) => v !== 5)).toBe(true)
    expect(mean(rolls)).toBeLessThan(game.marketRating)
  })

  it('cult games have a mean strictly above their market rating', () => {
    const game = makeGame({ traits: ['cult'], marketRating: 3 })
    const rand = mulberry32(101)
    const rolls = Array.from({ length: SAMPLE_SIZE }, () => rollTrueValue(game, rand))
    expect(mean(rolls)).toBeGreaterThan(game.marketRating)
  })

  it('contemplative games have a mean strictly above their market rating', () => {
    const game = makeGame({ traits: ['contemplative'], marketRating: 3 })
    const rand = mulberry32(102)
    const rolls = Array.from({ length: SAMPLE_SIZE }, () => rollTrueValue(game, rand))
    expect(mean(rolls)).toBeGreaterThan(game.marketRating)
  })

  it('hype games have a mean strictly below their market rating', () => {
    const game = makeGame({ traits: ['hype'], marketRating: 3 })
    const rand = mulberry32(103)
    const rolls = Array.from({ length: SAMPLE_SIZE }, () => rollTrueValue(game, rand))
    expect(mean(rolls)).toBeLessThan(game.marketRating)
  })

  it('annual-sequel games have a mean strictly below their market rating', () => {
    const game = makeGame({ traits: ['annual-sequel'], marketRating: 3 })
    const rand = mulberry32(104)
    const rolls = Array.from({ length: SAMPLE_SIZE }, () => rollTrueValue(game, rand))
    expect(mean(rolls)).toBeLessThan(game.marketRating)
  })

  it("a neutral game's (grind/prestige, or no trait) mean lands near its market rating", () => {
    for (const traits of [[], ['grind'], ['prestige']] as Game['traits'][]) {
      const game = makeGame({ traits, marketRating: 3 })
      const rand = mulberry32(105)
      const rolls = Array.from({ length: SAMPLE_SIZE }, () => rollTrueValue(game, rand))
      expect(mean(rolls)).toBeGreaterThan(2.7)
      expect(mean(rolls)).toBeLessThan(3.3)
    }
  })

  it('early-access has meaningfully higher variance than a neutral trait at the same rating', () => {
    const stdev = (values: number[]) => {
      const m = mean(values)
      return Math.sqrt(mean(values.map((v) => (v - m) ** 2)))
    }
    const neutral = makeGame({ traits: [], marketRating: 3 })
    const earlyAccess = makeGame({ traits: ['early-access'], marketRating: 3 })
    const neutralRand = mulberry32(11)
    const earlyAccessRand = mulberry32(11)
    const neutralRolls = Array.from({ length: SAMPLE_SIZE }, () => rollTrueValue(neutral, neutralRand))
    const earlyAccessRolls = Array.from(
      { length: SAMPLE_SIZE },
      () => rollTrueValue(earlyAccess, earlyAccessRand),
    )
    expect(stdev(earlyAccessRolls)).toBeGreaterThan(stdev(neutralRolls))
  })
})

describe('collectionScore', () => {
  it('sums scoreForValue over owned games', () => {
    const trueValues = { a: 1, b: 3, c: 5, d: 2 }
    expect(collectionScore(['a', 'c'], trueValues)).toBe(scoreForValue(1) + scoreForValue(5))
    expect(collectionScore(['a', 'b', 'c', 'd'], trueValues)).toBe(1 + 8 + 50 + 3)
  })

  it('returns 0 for an empty collection', () => {
    expect(collectionScore([], {})).toBe(0)
    expect(collectionScore([], { a: 4 })).toBe(0)
  })
})

describe('selectReviews', () => {
  it('returns exactly the requested count, drawn only from the pool', () => {
    const game = makeGame({ reviews: FULL_POOL })
    const rand = mulberry32(5)
    const selected = selectReviews(game, 4, rand, 3)
    expect(selected).toHaveLength(3)
    for (const review of selected) {
      expect(FULL_POOL).toContain(review)
    }
  })

  it('never returns duplicate reviews within one call', () => {
    const game = makeGame({ reviews: FULL_POOL })
    const rand = mulberry32(6)
    const selected = selectReviews(game, 2, rand, 5)
    expect(new Set(selected).size).toBe(selected.length)
  })

  it('caps the returned count at the pool size', () => {
    const game = makeGame({ reviews: FULL_POOL })
    const selected = selectReviews(game, 5, mulberry32(1), 999)
    expect(selected).toHaveLength(FULL_POOL.length)
  })

  it('across many seeds, includes at least one off-sentiment review every time (the noise guarantee)', () => {
    const game = makeGame({ reviews: FULL_POOL })
    for (let seed = 0; seed < 200; seed++) {
      const rand = mulberry32(seed * 97 + 1)
      const selected = selectReviews(game, 5, rand, 3) // trueValue=5 -> ideal sentiment is 'glowing'
      expect(selected.some((r) => r.sentiment !== 'glowing')).toBe(true)
    }
  })

  it('skews the selection toward sentiments matching the rolled true value', () => {
    const game = makeGame({ reviews: FULL_POOL })
    const rand = mulberry32(21)
    let glowingCount = 0
    let damningCount = 0
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const selected = selectReviews(game, 5, rand, 3)
      if (selected.some((r) => r.sentiment === 'glowing')) glowingCount++
      if (selected.some((r) => r.sentiment === 'damning')) damningCount++
    }
    // A trueValue of 5 should surface 'glowing' far more often than 'damning'.
    expect(glowingCount).toBeGreaterThan(damningCount)
  })
})
