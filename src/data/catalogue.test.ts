import { describe, expect, it } from 'vitest'
import { GAMES, LISTINGS, STOREFRONTS } from './catalogue'
import type { GameTrait } from '../lib/types'

const VALID_TRAITS: readonly GameTrait[] = [
  'contemplative',
  'asset-flip',
  'annual-sequel',
  'early-access',
  'cult',
  'hype',
  'grind',
  'prestige',
]

describe('catalogue integrity', () => {
  it('gives every game 1-3 valid traits', () => {
    for (const game of GAMES) {
      expect(game.traits.length).toBeGreaterThanOrEqual(1)
      expect(game.traits.length).toBeLessThanOrEqual(3)
      for (const trait of game.traits) {
        expect(VALID_TRAITS).toContain(trait)
      }
    }
  })

  it('gives every game an integer marketRating from 1 to 5', () => {
    for (const game of GAMES) {
      expect(Number.isInteger(game.marketRating)).toBe(true)
      expect(game.marketRating).toBeGreaterThanOrEqual(1)
      expect(game.marketRating).toBeLessThanOrEqual(5)
    }
  })

  it('shapes the rating distribution as a bell curve (fewer 1s and 5s than 2s/3s/4s)', () => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const game of GAMES) counts[game.marketRating]++

    for (const middle of [2, 3, 4]) {
      expect(counts[1]).toBeLessThan(counts[middle])
      expect(counts[5]).toBeLessThan(counts[middle])
    }
  })

  it('gives every game at least 5 reviews and a positive reviewCount', () => {
    for (const game of GAMES) {
      expect(game.reviews.length).toBeGreaterThanOrEqual(5)
      expect(game.reviewCount).toBeGreaterThan(0)
    }
  })

  it('keeps every listing id in sync with its storefront/game and both real', () => {
    const gameIds = new Set(GAMES.map((g) => g.id))
    const storeIds = new Set(STOREFRONTS.map((s) => s.id))
    for (const listing of LISTINGS) {
      expect(listing.id).toBe(`${listing.storefrontId}:${listing.gameId}`)
      expect(gameIds.has(listing.gameId)).toBe(true)
      expect(storeIds.has(listing.storefrontId)).toBe(true)
    }
  })

  it('lists every game on at least one storefront', () => {
    const listedGameIds = new Set(LISTINGS.map((l) => l.gameId))
    for (const game of GAMES) {
      expect(listedGameIds.has(game.id)).toBe(true)
    }
  })

  it('gives cream a higher mean market rating than flatshelf (store curation)', () => {
    function meanRatingFor(storefrontId: string): number {
      const ratings = LISTINGS.filter((l) => l.storefrontId === storefrontId).map((l) => {
        const game = GAMES.find((g) => g.id === l.gameId)
        if (!game) throw new Error(`Listing references unknown game ${l.gameId}`)
        return game.marketRating
      })
      return ratings.reduce((sum, r) => sum + r, 0) / ratings.length
    }

    expect(meanRatingFor('cream')).toBeGreaterThan(meanRatingFor('flatshelf'))
  })
})
