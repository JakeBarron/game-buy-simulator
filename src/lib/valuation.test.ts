import { describe, expect, it } from 'vitest'
import {
  SCORE_CURVE, scoreForValue, rollTrueValue, rollAllTrueValues, collectionScore, selectReviews,
  pickReappraisalTarget, applyReappraisal, earlyAdopterBonus,
  franchiseBonus, franchiseBonusForSize, totalEarlyAdopterBonus,
  scoreBreakdown, regretList, worstHold,
} from './valuation'
import { EARLY_ADOPTER_MULTIPLIER, FRANCHISE_BONUS_COEFFICIENT } from './config'
import type { Game, ReappraisalHistoryEntry, Review } from './types'

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

// ---------------------------------------------------------------------------
// Re-appraisal (Task 5, Part D)
// ---------------------------------------------------------------------------

describe('applyReappraisal', () => {
  it('moves true value and market rating by exactly 1 in the SAME direction, always clamped to 1-5, over many seeded rolls', () => {
    const rand = mulberry32(77)
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      // Cheap deterministic-from-rand setup values, not part of what's under test.
      const trueValue = 1 + Math.floor(rand() * 5)
      const marketRating = 1 + Math.floor(rand() * 5)
      const game = makeGame({ traits: [], marketRating })

      const result = applyReappraisal(game, trueValue, marketRating, rand)

      expect(['up', 'down']).toContain(result.direction)
      const delta = result.direction === 'up' ? 1 : -1

      expect(result.newTrueValue).toBe(Math.min(5, Math.max(1, trueValue + delta)))
      expect(result.newMarketRating).toBe(Math.min(5, Math.max(1, marketRating + delta)))
      expect(result.newTrueValue).toBeGreaterThanOrEqual(1)
      expect(result.newTrueValue).toBeLessThanOrEqual(5)
      expect(result.newMarketRating).toBeGreaterThanOrEqual(1)
      expect(result.newMarketRating).toBeLessThanOrEqual(5)
    }
  })
})

describe('pickReappraisalTarget + applyReappraisal: boundary respected', () => {
  it('a game already at true value 5 is never moved up, and one already at 1 is never moved down, over many seeded picks', () => {
    const maxed = makeGame({ id: 'maxed', traits: [], marketRating: 5 })
    const bottomed = makeGame({ id: 'bottomed', traits: [], marketRating: 1 })
    const games = [maxed, bottomed]
    const trueValues = { maxed: 5, bottomed: 1 }
    const rand = mulberry32(55)

    let sawMaxed = false
    let sawBottomed = false
    for (let i = 0; i < 1000; i++) {
      const targetId = pickReappraisalTarget({ trueValues }, games, rand)
      expect(targetId).not.toBeNull()
      const game = targetId === 'maxed' ? maxed : bottomed
      const trueValue = targetId === 'maxed' ? 5 : 1

      const result = applyReappraisal(game, trueValue, game.marketRating, rand)

      if (targetId === 'maxed') {
        sawMaxed = true
        expect(result.direction).toBe('down') // never 'up' — already at the boundary
      } else {
        sawBottomed = true
        expect(result.direction).toBe('up') // never 'down' — already at the boundary
      }
    }
    // Sanity: both branches of the assertion above actually ran.
    expect(sawMaxed).toBe(true)
    expect(sawBottomed).toBe(true)
  })
})

describe('pickReappraisalTarget: trait weighting is real', () => {
  it('over >=2000 seeded picks, cult games are re-appraised UP more often than hype games, by a margin well outside noise', () => {
    const cultGame = makeGame({ id: 'cult-game', traits: ['cult'], marketRating: 3 })
    const hypeGame = makeGame({ id: 'hype-game', traits: ['hype'], marketRating: 3 })
    const games = [cultGame, hypeGame]
    const trueValues = { 'cult-game': 3, 'hype-game': 3 }
    const rand = mulberry32(303)

    let cultUp = 0
    let hypeUp = 0
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const targetId = pickReappraisalTarget({ trueValues }, games, rand)
      const game = targetId === 'cult-game' ? cultGame : hypeGame
      const trueValue = trueValues[targetId as keyof typeof trueValues]
      const result = applyReappraisal(game, trueValue, game.marketRating, rand)
      if (targetId === 'cult-game' && result.direction === 'up') cultUp++
      if (targetId === 'hype-game' && result.direction === 'up') hypeUp++
    }

    // The two games are picked as often as each other (roughly symmetric total weight), but
    // conditioned on being picked, cult should go up far more often than hype does.
    expect(cultUp).toBeGreaterThan(hypeUp * 3)
  })
})

describe('earlyAdopterBonus', () => {
  it('doubles the GAIN, not the total: a 3-star -> 4-star move (curve 8 -> 20) yields 12 extra for an owner, not 40', () => {
    const bonus = earlyAdopterBonus(3, 4, true, 2)
    expect(bonus).toBe(12)
    expect(bonus).not.toBe(40)
    // Also true at the configured default multiplier.
    expect(earlyAdopterBonus(3, 4, true, EARLY_ADOPTER_MULTIPLIER)).toBe(12)
  })

  it('awards no bonus for an unowned game, even on an upward move', () => {
    expect(earlyAdopterBonus(3, 4, false, 2)).toBe(0)
  })

  it('awards no bonus for a downward move, even when owned', () => {
    expect(earlyAdopterBonus(4, 3, true, 2)).toBe(0)
  })
})

describe('collectionScore with early-adopter bonuses', () => {
  it('equals curve value plus accumulated bonuses, after several re-appraisals', () => {
    const trueValues = { a: 4, b: 2, c: 1 }
    const bonuses = { a: 12, c: 0 } // b never re-appraised, c re-appraised but with no bonus banked
    const expected = scoreForValue(4) + 12 + scoreForValue(2) + scoreForValue(1) + 0
    expect(collectionScore(['a', 'b', 'c'], trueValues, bonuses)).toBe(expected)
  })

  it('defaults to no bonus when the argument is omitted, matching pre-Task-5 behaviour', () => {
    const trueValues = { a: 4, b: 2 }
    expect(collectionScore(['a', 'b'], trueValues)).toBe(scoreForValue(4) + scoreForValue(2))
  })
})

describe('franchiseBonus', () => {
  it('pays the bonus for a fully-owned series and nothing for a series missing one game', () => {
    const a = makeGame({ id: 'a', series: 'trilogy' })
    const b = makeGame({ id: 'b', series: 'trilogy' })
    const c = makeGame({ id: 'c', series: 'trilogy' })
    const games = [a, b, c]

    expect(franchiseBonus(['a', 'b'], games)).toEqual([])

    const complete = franchiseBonus(['a', 'b', 'c'], games)
    expect(complete).toEqual([{ series: 'trilogy', size: 3, bonus: franchiseBonusForSize(3) }])
    expect(complete[0].bonus).toBeGreaterThan(0)
  })

  it('scales the bonus with series size in the intended direction: a larger set pays more than proportionally more than a pair', () => {
    const pairBonus = franchiseBonusForSize(2)
    const quadBonus = franchiseBonusForSize(4)
    expect(quadBonus).toBeGreaterThan(pairBonus)
    // Twice the members should be worth more than simply double the pair's bonus.
    expect(quadBonus).toBeGreaterThan(pairBonus * 2)
  })

  it('never contributes a bonus for a game with no series field', () => {
    const untagged = makeGame({ id: 'solo' })
    expect(franchiseBonus(['solo'], [untagged])).toEqual([])
  })

  it('still pays a (smaller) bonus for a single-game series, since owning it does complete that series', () => {
    const solo = makeGame({ id: 'solo-series', series: 'solo' })
    const result = franchiseBonus(['solo-series'], [solo])
    expect(result).toEqual([{ series: 'solo', size: 1, bonus: FRANCHISE_BONUS_COEFFICIENT }])
  })
})

describe('scoreBreakdown', () => {
  it('sums collection + earlyAdopter + franchise to the reported total', () => {
    const a = makeGame({ id: 'a', series: 'duo' })
    const b = makeGame({ id: 'b', series: 'duo' })
    const c = makeGame({ id: 'c' })
    const games = [a, b, c]
    const trueValues = { a: 4, b: 2, c: 5 }
    const earlyAdopterBonuses = { a: 12, c: 0 }
    const ownedGameIds = ['a', 'b', 'c']

    const result = scoreBreakdown(ownedGameIds, trueValues, earlyAdopterBonuses, games)

    expect(result.collection).toBe(scoreForValue(4) + scoreForValue(2) + scoreForValue(5))
    expect(result.earlyAdopter).toBe(totalEarlyAdopterBonus(earlyAdopterBonuses))
    expect(result.earlyAdopter).toBe(12)
    expect(result.franchise).toBe(franchiseBonusForSize(2))
    expect(result.total).toBe(result.collection + result.earlyAdopter + result.franchise)
  })
})

function makeHistoryEntry(overrides: Partial<ReappraisalHistoryEntry>): ReappraisalHistoryEntry {
  return {
    gameId: 'g',
    direction: 'up',
    oldTrueValue: 3,
    newTrueValue: 4,
    oldMarketRating: 3,
    newMarketRating: 4,
    owned: false,
    at: 1000,
    ...overrides,
  }
}

describe('regretList', () => {
  it('returns exactly the upward-re-appraised games the player did not own, excluding owned ones', () => {
    const history: ReappraisalHistoryEntry[] = [
      makeHistoryEntry({ gameId: 'missed-it', direction: 'up', owned: false, at: 1000 }),
      makeHistoryEntry({ gameId: 'owned-it', direction: 'up', owned: true, at: 2000 }),
      makeHistoryEntry({ gameId: 'dodged-it', direction: 'down', owned: false, at: 3000 }),
      makeHistoryEntry({ gameId: 'held-it-down', direction: 'down', owned: true, at: 4000 }),
    ]

    const result = regretList(history)
    expect(result).toHaveLength(1)
    expect(result[0].gameId).toBe('missed-it')
  })

  it('folds multiple qualifying events for the same unowned game into one row spanning the full swing', () => {
    const history: ReappraisalHistoryEntry[] = [
      makeHistoryEntry({
        gameId: 'double-move', owned: false, direction: 'up',
        oldTrueValue: 2, newTrueValue: 3, oldMarketRating: 2, newMarketRating: 3, at: 1000,
      }),
      makeHistoryEntry({
        gameId: 'double-move', owned: false, direction: 'up',
        oldTrueValue: 3, newTrueValue: 4, oldMarketRating: 3, newMarketRating: 4, at: 2000,
      }),
    ]

    const result = regretList(history)
    expect(result).toEqual([
      { gameId: 'double-move', oldTrueValue: 2, newTrueValue: 4, oldMarketRating: 2, newMarketRating: 4 },
    ])
  })

  it('excludes any event where the player already owned the game at the time it fired', () => {
    const history: ReappraisalHistoryEntry[] = [
      makeHistoryEntry({ gameId: 'bought-later', owned: false, direction: 'up', at: 1000 }),
      makeHistoryEntry({ gameId: 'bought-later', owned: true, direction: 'up', at: 5000 }),
    ]
    const result = regretList(history)
    expect(result).toHaveLength(1)
    expect(result[0].gameId).toBe('bought-later')
  })

  it('returns an empty list when nothing qualifies', () => {
    expect(regretList([])).toEqual([])
  })
})

describe('worstHold', () => {
  it('picks the owned game re-appraised down to the lowest true value, ignoring up-moves and unowned dips', () => {
    const history: ReappraisalHistoryEntry[] = [
      makeHistoryEntry({
        gameId: 'mild-dip', direction: 'down', owned: true, oldTrueValue: 4, newTrueValue: 3, at: 1000,
      }),
      makeHistoryEntry({
        gameId: 'bad-hold', direction: 'down', owned: true, oldTrueValue: 2, newTrueValue: 1, at: 2000,
      }),
      makeHistoryEntry({ gameId: 'ignored-up', direction: 'up', owned: true, at: 3000 }),
      makeHistoryEntry({ gameId: 'ignored-unowned', direction: 'down', owned: false, at: 4000 }),
    ]
    const result = worstHold(history)
    expect(result?.gameId).toBe('bad-hold')
  })

  it('returns null when nothing qualifies', () => {
    expect(worstHold([])).toBeNull()
  })
})
