import { describe, expect, it } from 'vitest'
import { gameReducer, initialRun } from './gameReducer'
import { loadConfig } from './config'
import { earlyAdopterBonus } from './valuation'
import { GAMES } from '../data/catalogue'
import type { RunState, Shift, Puzzle } from './types'

const config = loadConfig('', true) // isProd=true: no ?fast override, deterministic

// Tiny deterministic PRNG (mulberry32), same pattern as valuation.test.ts — statistical/roll
// tests must not depend on Math.random.
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

function freshRun(): RunState {
  return initialRun(0, config, mulberry32(1))
}

const PUZZLE: Puzzle = { kind: 'arithmetic', prompt: '1+1', answer: '2' }

describe('TICK: pricedOut transition', () => {
  it('does not end the run at t=0 with the starting balance, but does once the priced-out condition holds later', () => {
    const broke: RunState = {
      ...freshRun(),
      hoursRemaining: 0,
      // Isolate the priced-out mechanic from sale/release/re-appraisal rolls, which are
      // orthogonal to what this test checks.
      nextSaleAt: Number.MAX_SAFE_INTEGER,
      nextReleaseAt: Number.MAX_SAFE_INTEGER,
      nextReappraisalAt: Number.MAX_SAFE_INTEGER,
    }

    const early = gameReducer(broke, { type: 'TICK', now: 0, dt: 0, rand: mulberry32(2) }, config)
    expect(early.status).toBe('playing')

    const late = gameReducer(
      broke,
      { type: 'TICK', now: 45 * 60_000, dt: 45 * 60_000, rand: mulberry32(3) },
      config,
    )
    expect(late.status).toBe('pricedOut')
    expect(late.endedAt).toBe(45 * 60_000)
  })
})

describe('TICK: death by drain takes precedence', () => {
  it('ends the run as dead (not pricedOut, not shift-completed) and pays no wage, even mid-shift before workRequiredMs elapses', () => {
    const base = freshRun()
    // A deliberately extreme drain rate — unrelated to config's tuned value — just needs to
    // exceed balanceAtStart well within this tick's wallMs, so death is unambiguous.
    const shift: Shift = {
      startedAt: 0,
      workRequiredMs: config.WORK_REQUIRED_MS,
      bonusMs: 0,
      spacingOut: false,
      drainPerWorkMs: 2,
      wage: config.WAGE,
      puzzle: PUZZLE,
      puzzleSolvedAt: 0,
      balanceAtStart: 10,
      drainApplied: 0,
    }
    const dying: RunState = {
      ...base,
      hoursRemaining: 10,
      activeShift: shift,
      nextSaleAt: Number.MAX_SAFE_INTEGER,
      nextReleaseAt: Number.MAX_SAFE_INTEGER,
      nextReappraisalAt: Number.MAX_SAFE_INTEGER,
    }

    // wallMs = 10ms of work-time elapsed, drain = 2 * 10 = 20 >= balanceAtStart(10) -> dead,
    // well before workRequiredMs (45_000ms) would ever let the shift complete.
    const result = gameReducer(dying, { type: 'TICK', now: 10, dt: 10, rand: mulberry32(4) }, config)

    expect(result.status).toBe('dead')
    expect(result.hoursRemaining).toBe(0)
    expect(result.activeShift).toBeNull()
    // No wage paid, no shift counted as completed — the death return happens before step 3
    // (shift completion) or any of steps 4-7 (sale/release/priced-out) ever run.
    expect(result.hoursEarned).toBe(base.hoursEarned)
    expect(result.shiftsWorked).toBe(base.shiftsWorked)
    expect(result.endedAt).toBe(10)
  })
})

describe('TICK step order: release resolves before the priced-out check', () => {
  it('lets a same-tick release rescue the run, rather than the priced-out check winning a race against it', () => {
    const base = freshRun()

    const rescuerId = 'nothing-happens' // cheap release-pool game
    const releasePoolIds = GAMES.filter((g) => g.releasePool).map((g) => g.id)
    expect(releasePoolIds).toContain(rescuerId)
    const otherReleaseIds = releasePoolIds.filter((id) => id !== rescuerId)
    const startingIds = GAMES.filter((g) => !g.releasePool).map((g) => g.id)

    // Own literally everything currently available EXCEPT the rescuer, and everything but the
    // rescuer has already been released — so the only way the unowned set is non-empty this
    // tick is if the rescuer itself gets released THIS tick.
    const commonState: RunState = {
      ...base,
      hoursRemaining: 100_000, // affordability isn't what's under test — availability is
      ownedGameIds: [...startingIds, ...otherReleaseIds],
      releasedGameIds: [...otherReleaseIds],
      nextSaleAt: Number.MAX_SAFE_INTEGER,
      nextReappraisalAt: Number.MAX_SAFE_INTEGER, // isolate from the re-appraisal roll too
    }

    // Release is due this tick (nextReleaseAt <= now): the rescuer lands, the unowned set is
    // non-empty, and the run must NOT end.
    const releaseFires = gameReducer(
      { ...commonState, nextReleaseAt: 0 },
      { type: 'TICK', now: 1_000, dt: 1_000, rand: mulberry32(12) },
      config,
    )
    expect(releaseFires.releasedGameIds).toContain(rescuerId)
    expect(releaseFires.status).toBe('playing')

    // Identical state, but the release is NOT due this tick: the unowned set is genuinely
    // empty (the catalogue is exhausted from the player's perspective) and the run must end.
    const releaseWithheld = gameReducer(
      { ...commonState, nextReleaseAt: Number.MAX_SAFE_INTEGER },
      { type: 'TICK', now: 1_000, dt: 1_000, rand: mulberry32(12) },
      config,
    )
    expect(releaseWithheld.releasedGameIds).not.toContain(rescuerId)
    expect(releaseWithheld.status).toBe('pricedOut')
  })
})

describe('sale weighting (Part D)', () => {
  it('discounts low-rated games markedly more often than 5-star games, over many seeded sale rolls', () => {
    const base = freshRun()
    const dueForSale: RunState = {
      ...base,
      nextSaleAt: 0,
      nextReleaseAt: Number.MAX_SAFE_INTEGER, // isolate the sale roll from release rolls
      nextReappraisalAt: Number.MAX_SAFE_INTEGER, // ...and from the re-appraisal roll
    }

    // Restricted to non-releasePool games so every id here is actually eligible for a sale in
    // a fresh run (a release-pool game can never be discounted before it's released, which
    // would just dilute both groups' rates equally rather than being a meaningful confound —
    // but excluding them makes the comparison cleaner).
    const oneStarIds = GAMES.filter((g) => g.marketRating === 1 && !g.releasePool).map((g) => g.id)
    const fiveStarIds = GAMES.filter((g) => g.marketRating === 5 && !g.releasePool).map((g) => g.id)
    expect(oneStarIds.length).toBeGreaterThan(0)
    expect(fiveStarIds.length).toBeGreaterThan(0)

    const TRIALS = 500
    let oneStarDiscounted = 0
    let fiveStarDiscounted = 0

    for (let seed = 0; seed < TRIALS; seed++) {
      const result = gameReducer(
        dueForSale,
        { type: 'TICK', now: 1_000, dt: 1_000, rand: mulberry32(seed * 97 + 3) },
        config,
      )
      const discountedGameIds = new Set(
        Object.keys(result.activeSale?.discounts ?? {}).map((listingId) => listingId.split(':')[1]),
      )
      if (oneStarIds.some((id) => discountedGameIds.has(id))) oneStarDiscounted++
      if (fiveStarIds.some((id) => discountedGameIds.has(id))) fiveStarDiscounted++
    }

    const oneStarRate = oneStarDiscounted / TRIALS
    const fiveStarRate = fiveStarDiscounted / TRIALS

    // "Markedly" less likely per the brief — a conservative 2x bound, not the full weight
    // ratio (weight is (6-rating)**2 = 25x for 1-star vs 5-star, but observed inclusion rate
    // isn't the weight ratio directly once you account for without-replacement sampling
    // against the whole eligible pool).
    expect(oneStarRate).toBeGreaterThan(fiveStarRate * 2)
  })
})

describe('TICK: re-appraisal wiring (Task 5)', () => {
  it('fires when due: updates trueValues/marketRatingOverrides, records history, pushes an announcement, and reschedules', () => {
    const base = freshRun()
    const due: RunState = {
      ...base,
      nextSaleAt: Number.MAX_SAFE_INTEGER,
      nextReleaseAt: Number.MAX_SAFE_INTEGER,
      nextReappraisalAt: 0,
    }
    const now = 1_000

    const result = gameReducer(due, { type: 'TICK', now, dt: now, rand: mulberry32(9) }, config)

    expect(result.reappraisalHistory).toHaveLength(1)
    const entry = result.reappraisalHistory[0]
    expect(entry.at).toBe(now)
    expect(['up', 'down']).toContain(entry.direction)
    // Fresh run owns nothing yet, so this is always an unowned event.
    expect(entry.owned).toBe(false)

    // The history entry's new values are exactly what landed in the live state.
    expect(result.trueValues[entry.gameId]).toBe(entry.newTrueValue)
    expect(result.marketRatingOverrides[entry.gameId]).toBe(entry.newMarketRating)
    expect(entry.oldTrueValue).toBe(base.trueValues[entry.gameId])

    const announcement = result.announcements.find((a) => a.kind === 'reappraisal')
    expect(announcement).toBeDefined()
    expect(announcement?.reappraisal).toEqual({ owned: false, direction: entry.direction })
    expect(announcement?.text).toContain('re-rated')

    // Rescheduled within the configured interval from `now`, not from the run's start.
    expect(result.nextReappraisalAt).toBeGreaterThanOrEqual(now + config.REAPPRAISAL_INTERVAL_MS.min)
    expect(result.nextReappraisalAt).toBeLessThanOrEqual(now + config.REAPPRAISAL_INTERVAL_MS.max)

    // Unowned upward move: no bonus banked (only the owned+up case earns one).
    if (entry.direction === 'up') {
      expect(result.earlyAdopterBonuses[entry.gameId]).toBeUndefined()
    }
  })
})

describe('TICK step order: re-appraisal resolves before the priced-out check', () => {
  it('records a same-tick re-appraisal even when the tick also ends the run as pricedOut, so its effects are not lost to ordering', () => {
    const broke: RunState = {
      ...freshRun(),
      hoursRemaining: 0,
      nextSaleAt: Number.MAX_SAFE_INTEGER,
      nextReleaseAt: Number.MAX_SAFE_INTEGER,
      nextReappraisalAt: 0, // due this tick, unlike the isolated pricedOut-transition test above
    }

    const result = gameReducer(
      broke,
      { type: 'TICK', now: 45 * 60_000, dt: 45 * 60_000, rand: mulberry32(3) },
      config,
    )

    expect(result.status).toBe('pricedOut')
    expect(result.reappraisalHistory).toHaveLength(1)
    expect(result.announcements.some((a) => a.kind === 'reappraisal')).toBe(true)
  })
})

describe('TICK: early-adopter bonus honors ownership (Task 5)', () => {
  it('credits the bonus only when the re-appraised game is owned, and only on an upward move', () => {
    const base = freshRun()
    // A mid-range, trait-neutral game (grind/prestige only pull the up/down weighting 50/50,
    // per REAPPRAISAL_TRAIT_WEIGHT — a heavily-biased trait like hype would make one branch too
    // rare to reliably observe in a bounded number of trials) and not already at a true-value
    // boundary, so both an owned-up and an owned-down outcome are reachable across seeds.
    const ownedId = GAMES.find(
      (g) =>
        !g.releasePool &&
        g.traits.every((t) => t === 'grind' || t === 'prestige') &&
        base.trueValues[g.id] > 1 &&
        base.trueValues[g.id] < 5,
    )!.id

    const owning: RunState = {
      ...base,
      hoursRemaining: 100_000, // affordability/pricedOut isn't what's under test
      ownedGameIds: [ownedId],
      nextSaleAt: Number.MAX_SAFE_INTEGER,
      nextReleaseAt: Number.MAX_SAFE_INTEGER,
    }

    let sawOwnedUpWithBonus = false
    let sawOwnedDownNoBonus = false
    let sawOtherUpNoBonus = false

    const TRIALS = 500
    for (let seed = 0; seed < TRIALS; seed++) {
      const due: RunState = { ...owning, nextReappraisalAt: 0 }
      const result = gameReducer(
        due,
        { type: 'TICK', now: 1_000, dt: 1_000, rand: mulberry32(seed * 131 + 17) },
        config,
      )
      const entry = result.reappraisalHistory[0]
      if (!entry) continue

      if (entry.gameId === ownedId) {
        expect(entry.owned).toBe(true)
        if (entry.direction === 'up') {
          const expectedBonus = earlyAdopterBonus(
            entry.oldTrueValue,
            entry.newTrueValue,
            true,
            config.EARLY_ADOPTER_MULTIPLIER,
          )
          expect(result.earlyAdopterBonuses[ownedId]).toBe(expectedBonus)
          if (expectedBonus > 0) sawOwnedUpWithBonus = true
        } else {
          expect(result.earlyAdopterBonuses[ownedId] ?? 0).toBe(0)
          sawOwnedDownNoBonus = true
        }
      } else {
        expect(entry.owned).toBe(false)
        expect(result.earlyAdopterBonuses[entry.gameId]).toBeUndefined()
        if (entry.direction === 'up') sawOtherUpNoBonus = true
      }
    }

    // Sanity: every branch of the assertions above actually ran at least once over 500 trials.
    expect(sawOwnedUpWithBonus).toBe(true)
    expect(sawOwnedDownNoBonus).toBe(true)
    expect(sawOtherUpNoBonus).toBe(true)
  })
})
