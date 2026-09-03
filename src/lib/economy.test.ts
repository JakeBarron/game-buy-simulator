import { describe, expect, it } from 'vitest'
import {
  currentPrice, cheapestUnownedPrice, isPricedOut, canAfford, availableGameIds,
} from './economy'
import { initialRun } from './gameReducer'
import { loadConfig } from './config'
import { inflatedPrice } from './inflation'
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
  // NOTE on test design: an earlier version of this test compared the same discount applied
  // early vs. late in a run and asserted the later price was higher. That's necessary but does
  // NOT pin the order — real-number multiplication commutes, so
  // `basePrice * inflationMult * (1 - pct)` and `basePrice * (1 - pct) * inflationMult` are
  // identical regardless of which "step" is labeled inflation vs. discount, and both still grow
  // with elapsedMs. The two orders only diverge once you account for the ACTUAL implementation
  // rounding at each step (currentPrice rounds the inflated price, then rounds again after the
  // discount) rather than rounding once at the very end. This test picks inputs where that
  // rounding makes the two orders land on genuinely different integers, and pins currentPrice to
  // the correct one: base -> inflation -> ROUND -> discount -> ROUND -> MIN_PRICE floor. Getting
  // this backwards (discount-then-inflate) would make a sale's absolute Ħ value shrink relative
  // to inflation as a run goes on instead of growing with it, undermining the "wait for a sale"
  // tension the whole design rests on.
  it('pins inflation-before-discount: rounds the inflated price first, THEN applies the discount to that rounded value', () => {
    const listing: Listing = { id: 'dazzle:widget', storefrontId: 'dazzle', gameId: 'widget', price: 99 }
    const elapsedMs = 200_000 // dazzle's rate is 1.0, so inflationMultiplier = 2 ** (200000/150000)
    const discountPct = 33
    const sale: Sale = {
      id: 'sale-pin',
      name: 'Pin Sale',
      startedAt: 0,
      endsAt: 10_000_000,
      discounts: { [listing.id]: discountPct },
    }

    // The CORRECT order (what currentPrice must do): round the inflated price first...
    const inflatedFirst = inflatedPrice(listing.price, elapsedMs, 1.0, config) // round(99 * 2.519842..) = 249
    const correctOrder = Math.max(config.MIN_PRICE, Math.round(inflatedFirst * (1 - discountPct / 100))) // round(249 * 0.67) = 167

    // ...vs. the WRONG order a discount-first implementation would produce: round the discounted
    // base, THEN inflate that.
    const discountedBase = Math.max(config.MIN_PRICE, Math.round(listing.price * (1 - discountPct / 100))) // round(99 * 0.67) = 66
    const wrongOrder = inflatedPrice(discountedBase, elapsedMs, 1.0, config) // round(66 * 2.519842..) = 166

    // These two numbers must actually differ, or this test would pass no matter which order
    // currentPrice used — that's the whole point of picking rounding-sensitive inputs.
    expect(correctOrder).not.toBe(wrongOrder)
    expect(correctOrder).toBe(167)
    expect(wrongOrder).toBe(166)

    expect(currentPrice(listing, sale, elapsedMs, config)).toBe(correctOrder)
  })

  it('still charges MORE for the same discount later in a run than earlier (directional sanity check, not a substitute for the pinning test above)', () => {
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
