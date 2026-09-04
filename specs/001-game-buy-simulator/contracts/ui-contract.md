> **Superseded by the speculation loop (branch `002-speculation-loop`).** This document is the
> record of what spec 001 specified at the end of the POC; it is not current. In particular:
> - There is no `won` status and no victory/completion check. `RunStatus` is now
>   `'playing' | 'dead' | 'pricedOut'` — a run ends when the player can no longer afford anything
>   available, even after one more shift (`economy.isPricedOut`), not by owning everything.
> - `BUY`, `START_SHIFT`, and `TICK` no longer take a bare `now`/`config` only — `TICK` also
>   carries `dt` and a `rand` (see `src/lib/types.ts` `GameAction`), and pricing now composes
>   inflation and sale discount (`economy.currentPrice`), not a static listing price.
> - The `TICK` resolution order below is missing three steps added later: a re-appraisal roll
>   (the crowd changes its mind about a game mid-run — Task 5), the priced-out check that replaced
>   step 7's victory check, and franchise-bonus/regret-list derivation on the end screen (Task 6).
> - `hasWon`/`won` copy in the View contract is retired; there's a priced-out ending and a regret
>   screen instead.
>
> `src/lib/gameReducer.ts` and `src/lib/types.ts` are the current source of truth for the action
> surface and resolution order. This file is kept as a historical record of spec 001, not updated
> to track later tasks.

# UI & Reducer Contract: Game Buy Simulator

This app exposes no network API. Its only contracts are the reducer's action surface (the boundary
between components and logic) and the views' observable behavior. Both are stated here so
implementation and verification agree on what "correct" means.

## Reducer actions

`gameReducer(state, action) => state` is pure: no `Date.now()`, no randomness, no storage. Time and
entropy are passed in by the caller, which is what makes the reducer replayable and testable.

| Action | Payload | Preconditions | Effect |
|---|---|---|---|
| `BUY` | `{ listingId, now }` | `status === 'playing'`; game unowned; `currentPrice <= hoursRemaining` | Deducts `currentPrice`, adds game to `ownedGameIds`, appends a `PurchaseRecord`. May transition to `dead` (balance 0) or `won` (owns everything). |
| `START_SHIFT` | `{ puzzle, now, config }` | `status === 'playing'`; `activeShift === null` | Creates `activeShift` with `startedAt = now` and `balanceAtStart`. **Not blocked** when unaffordable (FR-040). |
| `SOLVE_PUZZLE` | `{ answer, now }` | `activeShift` exists and unsolved | Sets `puzzleSolvedAt` on a correct answer. **Does not alter `workRequiredMs` or advance progress** (FR-017). Wrong answers are rejected without penalty and without state change (FR-016). |
| `SET_SPACING_OUT` | `{ spacingOut, now }` | `activeShift` exists and puzzle solved | Starts or stops accruing `bonusMs`. Must be driven by a held control; the reducer records the flag, and `TICK` accrues the bonus (FR-051, FR-053). |
| `TICK` | `{ now }` | always | Runs the full resolution order below. The only action that completes shifts, expires sales, starts sales/releases, and kills the player. |
| `DISMISS_ANNOUNCEMENT` | `{ id }` | always | Removes one toast (FR-024). |
| `SET_STOREFRONT` | `{ storefrontId }` | always except terminal states | UI-only; never touches balance or library (FR-007). |
| `RESTART` | `{ now }` | always, from any state (FR-050) | Returns a fresh `RunState`. |

**Rejected actions are no-ops that return the identical state object.** Components read
preconditions via `economy.ts` selectors to disable controls up front, so a rejected action means a
UI bug, not a normal path.

### `TICK` resolution order (normative — research D6)

0. If `spacingOut`, add `2 × dt` to `bonusMs` (giving a 3x total work-time rate), capped so total
   work-time cannot exceed `workRequiredMs`.
1. Apply shift drain for elapsed time, bounded by `workRequiredMs` — baseline ms at the resting rate
   and bonus ms at 1.5x (research D6b).
2. If the balance hits 0 during the shift → `dead`, **wage not paid** (FR-039). Stop.
3. If work-time ≥ `workRequiredMs` → pay `wage`, increment `shiftsWorked`, clear `activeShift`.
4. Expire `activeSale` if `now >= endsAt`; restore prices (FR-027).
5. If `now >= nextSaleAt` and no active sale → start a sale, emit a `sale` announcement.
6. If `now >= nextReleaseAt` and the reserve pool is non-empty → release a game, emit a `release`
   announcement.
7. Victory check — **before** step 6's release can count against it (spec Edge Cases).

A single `TICK` must correctly resolve an arbitrarily long gap since the previous tick, including
one spanning a whole shift, because the tab may have been closed.

## View contract

| View | Must show | Must not allow |
|---|---|---|
| **Header** (always) | `hoursRemaining` to 1 decimal, falling live during a shift (FR-038); shift remaining time when active (FR-021); collection progress as owned/available (FR-044); a warning when a full shift is unaffordable (FR-049) | — |
| **Store** | Storefront selector for all 3; grid of listings with thumbnail, title, blurb, price; sale badge with struck-through original beside sale price (FR-026); `Owned` state on owned games (FR-009); all-owned empty state | Buying an owned game; buying when unaffordable (control disabled, with the reason visible) |
| **Work** | Puzzle first (FR-015); after solving, a countdown plus a hold-to-space-out control; the shift's hour cost at rest **and** spaced out shown before committing (FR-040, FR-049); live-falling balance and the current drain rate (FR-054) | Starting a second concurrent shift (FR-019); any path that shortens the timer other than spacing out; latching or automating the hold (FR-055) |
| **Library** | Owned games with title and thumbnail; empty state when nothing is owned | Playing, refunding, or selling anything (FR-041) |
| **History** | Chronological records with game, storefront, price paid, discount, timestamp; total hours spent (FR-031) | Editing or deleting records |
| **End screen** | Death and victory variants; games bought, hours spent, shifts worked; restart | Any purchase or shift while terminal (FR-003) |
| **Announcement toast** | Sale and release variants; auto-dismiss after a few seconds; manual dismiss (FR-024) | Blocking or interrupting an in-progress shift |

## Navigation contract

Store, Work, Library, and History are reachable from each other in exactly one action (SC-007). A
shift keeps running across every navigation (FR-021) — navigation never touches shift state.

## Persistence contract

- Every state change writes the whole run to `localStorage["gbs.run.v1"]`.
- On load: missing, malformed, or version-mismatched data ⇒ silently start a fresh run.
- On load with a valid save: replay elapsed time through the `TICK` order **before first render**,
  so the player never sees a stale balance that then jumps. `spacingOut` always restores as `false`;
  time away accrues at the resting rate only (FR-056).
- Clearing localStorage is equivalent to a fresh run, and is the documented recovery path for a
  corrupted save.

## Determinism contract

`gameReducer`, `economy.ts`, and `timeEngine.ts` contain no `Date.now()`, no `Math.random()`, and no
storage access. Callers inject `now`, `dt`, and any randomness. Consequence: given the same persisted state
and the same `now`, the app always resolves to the same result — which is what makes
death-while-away and shift completion verifiable rather than merely plausible.
