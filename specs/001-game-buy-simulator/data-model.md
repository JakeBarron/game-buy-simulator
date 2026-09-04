> **Superseded by the speculation loop (branch `002-speculation-loop`).** This document is the
> record of what spec 001 specified at the end of the POC; it is not current. In particular:
> - `RunStatus` is `'playing' | 'dead' | 'pricedOut'`, not `'playing' | 'dead' | 'won'` — there is
>   no win/completion state (see `contracts/ui-contract.md`'s header note for the same change).
> - `Game`/`Listing`/`Storefront` gained fields this document doesn't list: `traits`,
>   `marketRating`, `reviewCount`, `reviews`, and an optional `series` on `Game`; an
>   `inflationRate` on `Storefront` (each store now inflates its prices at its own rate — see
>   `src/lib/inflation.ts`). Listing prices are no longer static.
> - `RunState` grew substantially: `trueValues`, `displayedReviews`, `marketRatingOverrides`,
>   `earlyAdopterBonuses`, `reappraisalHistory`, `nextReappraisalAt` (the hidden-value/re-appraisal
>   system, Task 3 and Task 5), plus `welcomeSeen`, `activeStorefrontId`, and `announcements`.
> - Pricing is no longer just the catalogue's static `price` — see `economy.currentPrice`, which
>   composes inflation, then sale discount, then a `MIN_PRICE` floor.
> - Scoring (`valuation.scoreBreakdown`) — collection score plus early-adopter and franchise
>   bonuses — has no equivalent here at all; it postdates this document.
>
> `src/lib/types.ts` is the current source of truth for every shape below. This file is kept as a
> historical record of spec 001, not updated to track later tasks.

# Phase 1 Data Model: Game Buy Simulator

All types live in `src/lib/types.ts`. Everything is client-side; there is no wire format and no
database. "Persisted" below means part of the single localStorage blob.

## Static catalogue data (`src/data/catalogue.ts`, never mutated)

### Game

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Stable slug, e.g. `neon-abyss-tactics`. Used as the thumbnail hash seed. |
| `title` | `string` | Invented parody title. No real trademarks (spec Assumptions). |
| `blurb` | `string` | One to two sentences (FR-005). |
| `basePrice` | `number` | Hours. Reference price; each listing may differ. |
| `releasePool` | `boolean` | `true` = held back for mid-run release (FR-045), absent from the starting catalogue. |

### Storefront

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `vapor`, `crate`, `orbit`. |
| `name` | `string` | Original parody name. |
| `tagline` | `string` | Shown in the store header. |
| `theme` | `{ bg, fg, accent }` | CSS custom property values giving each store a distinct identity (SC-008). |

### Listing

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | `${storefrontId}:${gameId}` — the composite key used by sale discount maps. |
| `storefrontId` | `string` | |
| `gameId` | `string` | |
| `price` | `number` | This store's price for this game. The same game intentionally differs across stores (FR-008). |

**Invariant**: a game may appear in 1–3 storefronts. Owning it anywhere marks it owned everywhere
(FR-009), so the win requires each distinct *game* once, not each listing (FR-042).

## Run state (persisted, owned by the reducer)

### RunState

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `number` | Mismatch on load ⇒ discard save, fresh run (research D7). |
| `status` | `'playing' \| 'dead' \| 'won'` | Terminal states block purchases and shifts. |
| `hoursRemaining` | `number` | Float — it drains continuously during shifts. Never below 0. |
| `startedAt` | `number` | Epoch ms. Used for run-length stats. |
| `ownedGameIds` | `string[]` | Serialized as an array; held as a `Set` in memory. |
| `history` | `PurchaseRecord[]` | Chronological, append-only. |
| `shiftsWorked` | `number` | Completed shifts only. |
| `hoursDrained` | `number` | Cumulative hours lost to shifts. Needed for the SC-006 audit. |
| `hoursEarned` | `number` | Cumulative wages. Needed for the SC-006 audit. |
| `releasedGameIds` | `string[]` | Release-pool games that have entered the catalogue. |
| `activeShift` | `Shift \| null` | At most one (FR-019). |
| `activeSale` | `Sale \| null` | At most one; no stacking (FR-028). |
| `nextSaleAt` | `number` | Epoch ms of the next sale roll. |
| `nextReleaseAt` | `number` | Epoch ms of the next release roll. |
| `endedAt` | `number \| null` | Set when status leaves `playing`. |

**Balance invariant (SC-006)**, checkable at any moment:

```
hoursRemaining === startingHours
                 - sum(history[].pricePaid)
                 - hoursDrained
                 + hoursEarned
```

### Shift

| Field | Type | Notes |
|---|---|---|
| `startedAt` | `number` | Epoch ms. Source of truth for the **baseline** portion of progress (research D5). |
| `workRequiredMs` | `number` | 45_000 — the work-time a shift takes at rest (FR-017). |
| `bonusMs` | `number` | Accumulated extra work-time bought by spacing out. Grows only while the control is held (research D6b). |
| `spacingOut` | `boolean` | Transient-ish: true while the control is held. Persisted as `false`; a save is never restored mid-hold (FR-055, FR-056). |
| `drainPerWorkMs` | `number` | Resting drain rate per ms of work-time. |
| `wage` | `number` | Paid once, only on completion (FR-018). Strictly greater than a resting shift's total drain (FR-037). |
| `puzzle` | `Puzzle` | Must be solved to begin (FR-015). |
| `puzzleSolvedAt` | `number \| null` | Recorded but has **no effect on duration** (FR-017) — this is the joke. |
| `balanceAtStart` | `number` | Enables replaying death-while-away without tick history (research D6). |

**Derived, never stored**:

```
wallMs   = min(now - startedAt, workRequiredMs - bonusMs)   // baseline, capped
workMs   = wallMs + bonusMs
remaining = max(0, workRequiredMs - workMs)
drained  = drainPerWorkMs × wallMs  +  SPACE_DRAIN_MULT × drainPerWorkMs × bonusMs
```

`SPACE_DRAIN_MULT` is 1.5. The two portions drain at **different rates**, which is why the split
must be stored rather than a single total (research D6b).

**Reference values** (tuning targets, not requirements): `workRequiredMs` 45_000,
`drainPerWorkMs` 0.006 h/ms → 270 hours for a resting shift, `wage` 600 → net +330. A fully
spaced-out shift completes in ~15 real seconds, drains ~360, and nets ~+240 (SC-011).

### Puzzle

| Field | Type | Notes |
|---|---|---|
| `kind` | `'arithmetic' \| 'match-shape' \| 'type-word'` | Small set, all trivial (FR-015, SC-004). |
| `prompt` | `string` | |
| `answer` | `string` | Compared case-insensitively, trimmed. |
| `choices` | `string[]?` | Present for choice-based kinds. |

Wrong answers cost nothing and allow retries (FR-016).

### Sale

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `name` | `string` | From a pool mixing plausible and absurd reasons (FR-023). |
| `startedAt` / `endsAt` | `number` | Bounded duration (FR-027). |
| `discounts` | `Record<listingId, number>` | Percent off, per listing. A listing appears at most once, so discounts cannot stack (FR-028). |

**Rule**: sale price = `max(MIN_PRICE, round(listing.price × (1 - percent/100)))`. Never zero or
negative (FR-028).

### PurchaseRecord

| Field | Type | Notes |
|---|---|---|
| `gameId`, `storefrontId` | `string` | |
| `listPrice` | `number` | Price before discount. |
| `pricePaid` | `number` | What was actually deducted (FR-011). |
| `discountPercent` | `number` | 0 when bought at full price. |
| `purchasedAt` | `number` | Epoch ms. |

### Announcement (transient, not persisted)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `kind` | `'sale' \| 'release'` | Sales and releases share one toast component (research D4/spec Assumptions). |
| `text` | `string` | |
| `expiresAt` | `number` | Auto-dismiss; also manually dismissible (FR-024). |

Announcements are deliberately not persisted — a toast the player never saw is not worth restoring.

## State transitions

```
                  buy (affordable, unowned)
   ┌──────────────────────────────────────────────┐
   │                                              ▼
[playing] ──start shift──> [playing + activeShift] ──shift completes──> [playing] (+wage)
   │                              │
   │                              └──drain exhausts balance──> [dead]   (wage never paid, FR-039)
   │
   ├── balance reaches 0 via purchase ──> [dead]
   ├── owns every available game ───────> [won]
   └── restart (available any time, FR-050) ──> fresh [playing]
```

**Spacing out** is a rate modifier inside an active shift, not a state of its own: holding the
control accrues `bonusMs`, releasing it stops the accrual. Blur, view change, shift end, and death
all force it off (FR-053, FR-055).

**Resolution order per tick and on load** (research D6): drain/death → shift completion → sale
expiry → sale roll → release roll → victory check. Victory is evaluated *before* a release can land,
so a win cannot be stolen by a race (spec Edge Cases).

## Derived values (pure, in `economy.ts`)

- `currentPrice(listing, sale)` — applies the active discount and the price floor.
- `canAfford(state, price)` — strictly `price <= hoursRemaining` (FR-004: no overdraft).
- `isOwned(state, gameId)` — game-level, not listing-level.
- `availableGameIds(state)` — starting catalogue plus `releasedGameIds`; the victory denominator.
- `collectionProgress(state)` — `{ owned, available }`, where `available` grows (FR-044).
- `restingShiftCost(config)` — total drain of a shift worked at rest; drives the FR-049 "you cannot
  afford to go to work" warning.
- `spacedShiftCost(config)` — total drain if spaced out throughout (~1.33x the resting cost). Used to
  warn that zoning out can kill a player who could have survived the shift at rest (FR-049).
- `currentDrainRate(shift)` — resting or accelerated; shown live so the player can watch the faster
  burn (FR-054).
- `runStats(state)` — games owned, hours spent, shifts worked, hours drained, run duration.

## Persistence format

One key, whole-blob write on every state change (the state is a few KB; debouncing is structure
ahead of need):

```
localStorage["gbs.run.v1"] = JSON.stringify(RunState)
```

On load: parse → if missing, malformed, or `schemaVersion` mismatched, start a fresh run → otherwise
replay elapsed time through the resolution order above before the first render, so the player sees
the correct post-absence state rather than a stale one that visibly corrects itself.
