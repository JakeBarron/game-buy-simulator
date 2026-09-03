import { describe, expect, it } from 'vitest'
import {
  currentPrice, cheapestUnownedPrice, isPricedOut, canAfford, availableGameIds,
} from './economy'
import { initialRun } from './gameReducer'
import { loadConfig } from './config'
import type { Listing, Sale, RunState } from './types'

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

describe('currentPrice composition order (base -> inflation -> sale discount -> floor)', () => {
  it('charges MORE for the same game under the same sale later in a run than earlier (inflation applies before the discount, not after)', () => {
    const listing: Listing = { id: 'cream:widget', storefrontId: 'cream', gameId: 'widget', price: 100 }
    const sale: Sale = {
      id: 'sale-1',
      name: 'Test Sale',
      startedAt: 0,
      endsAt: 10_000_000,
      discounts: { [listing.id]: 50 }, // same 50%-off deal, both times
    }

    const early = currentPrice(listing, sale, 0, config)
    const late = currentPrice(listing, sale, 5 * 60_000, config) // 5 minutes in

    expect(late).toBeGreaterThan(early)
  })

  it('never charges below MIN_PRICE even under a steep late-run discount', () => {
    const listing: Listing = { id: 'cream:cheap', storefrontId: 'cream', gameId: 'cheap', price: 2 }
    const sale: Sale = {
      id: 'sale-2',
      name: 'Steep Sale',
      startedAt: 0,
      endsAt: 10_000_000,
      discounts: { [listing.id]: 85 },
    }
    expect(currentPrice(listing, sale, 0, config)).toBeGreaterThanOrEqual(config.MIN_PRICE)
  })
})

describe('isPricedOut', () => {
  it('is false at t=0 with the starting balance', () => {
    const state = freshRun()
    expect(isPricedOut(state, 0, config)).toBe(false)
  })

  it('is true for a broke player late in a run', () => {
    const state: RunState = { ...freshRun(), hoursRemaining: 0 }
    const lateElapsedMs = 40 * 60_000 // 40 minutes in
    expect(isPricedOut(state, lateElapsedMs, config)).toBe(true)
  })

  it('is true once every available game is owned (catalogue exhausted), regardless of balance', () => {
    const base = freshRun()
    const state: RunState = {
      ...base,
      hoursRemaining: 1_000_000, // plenty of money — exhaustion alone must still end the run
      ownedGameIds: availableGameIds(base),
    }
    expect(cheapestUnownedPrice(state, 0, config)).toBeNull()
    expect(isPricedOut(state, 0, config)).toBe(true)
  })

  it('is false when the player cannot afford the cheapest game right now but COULD after one more shift (the fairness boundary)', () => {
    const state: RunState = { ...freshRun(), hoursRemaining: 1 }
    const elapsedMs = 0

    // Confirm the premise: broke right now relative to the cheapest listing.
    const cheapestNow = cheapestUnownedPrice(state, elapsedMs, config)
    expect(cheapestNow).not.toBeNull()
    expect(canAfford(state, cheapestNow as number)).toBe(false)

    // But the run must NOT end here — they can still work one more shift.
    expect(isPricedOut(state, elapsedMs, config)).toBe(false)
  })
})
