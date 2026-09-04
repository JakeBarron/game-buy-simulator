import { describe, expect, it } from 'vitest'
import { inflationMultiplier, inflatedPrice } from './inflation'
import { loadConfig } from './config'
import { STOREFRONTS } from '../data/catalogue'

const config = loadConfig('', true) // isProd=true: no ?fast override, deterministic

function rateFor(id: string): number {
  const store = STOREFRONTS.find((s) => s.id === id)
  if (!store) throw new Error(`unknown storefront ${id}`)
  return store.inflationRate
}

describe('inflationMultiplier', () => {
  it('is exactly 1 at elapsedMs = 0, for any store rate', () => {
    expect(inflationMultiplier(0, 1.0, config)).toBe(1)
    expect(inflationMultiplier(0, 1.3, config)).toBe(1)
    expect(inflationMultiplier(0, 0.7, config)).toBe(1)
  })

  it('is exactly 2 at one doubling interval with storeRate 1.0', () => {
    expect(inflationMultiplier(config.INFLATION_DOUBLING_MS, 1.0, config)).toBe(2)
  })

  it('is exactly 4 at two doubling intervals with storeRate 1.0', () => {
    expect(inflationMultiplier(config.INFLATION_DOUBLING_MS * 2, 1.0, config)).toBeCloseTo(4, 10)
  })

  it('cream inflates strictly faster than dazzle, which inflates strictly faster than flatshelf, at the same elapsed time', () => {
    const cream = rateFor('cream')
    const dazzle = rateFor('dazzle')
    const flatshelf = rateFor('flatshelf')
    // Sanity: this test is only meaningful if the catalogue really encodes
    // that ordering in its rates.
    expect(cream).toBeGreaterThan(dazzle)
    expect(dazzle).toBeGreaterThan(flatshelf)

    for (const elapsedMs of [1_000, 60_000, 150_000, 5 * 60_000]) {
      const creamMult = inflationMultiplier(elapsedMs, cream, config)
      const dazzleMult = inflationMultiplier(elapsedMs, dazzle, config)
      const flatshelfMult = inflationMultiplier(elapsedMs, flatshelf, config)
      expect(creamMult).toBeGreaterThan(dazzleMult)
      expect(dazzleMult).toBeGreaterThan(flatshelfMult)
    }
  })
})

describe('inflatedPrice', () => {
  it('never returns below MIN_PRICE, even for a tiny base price far into a run', () => {
    const price = inflatedPrice(1, 0, 1.0, config)
    expect(price).toBeGreaterThanOrEqual(config.MIN_PRICE)

    // Inflation only ever grows a price, so MIN_PRICE can really only bind
    // at elapsedMs = 0 for a sub-MIN_PRICE base — but assert the clamp
    // holds for a range of times regardless, as a regression guard.
    for (const elapsedMs of [0, 1, 1_000, 10 * 60_000]) {
      expect(inflatedPrice(0, elapsedMs, 1.0, config)).toBeGreaterThanOrEqual(config.MIN_PRICE)
    }
  })

  it('always returns a whole number', () => {
    for (const elapsedMs of [0, 1_234, 60_000, 150_000, 7 * 60_000 + 321]) {
      for (const rate of [0.7, 1.0, 1.3]) {
        const price = inflatedPrice(37, elapsedMs, rate, config)
        expect(Number.isInteger(price)).toBe(true)
      }
    }
  })

  it('doubles a base price at exactly one doubling interval with storeRate 1.0', () => {
    expect(inflatedPrice(50, config.INFLATION_DOUBLING_MS, 1.0, config)).toBe(100)
  })

  it('is monotonically non-decreasing in elapsedMs for a fixed store rate', () => {
    const rate = 1.3
    let prev = inflatedPrice(100, 0, rate, config)
    for (let t = 1_000; t <= 10 * 60_000; t += 1_000) {
      const price = inflatedPrice(100, t, rate, config)
      expect(price).toBeGreaterThanOrEqual(prev)
      prev = price
    }
  })
})
