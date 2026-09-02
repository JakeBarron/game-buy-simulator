# Implementation Plan: Game Buy Simulator

**Branch**: `001-game-buy-simulator` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-game-buy-simulator/spec.md`

## Summary

A single-page browser game satirizing digital storefronts: the player spends **hours-till-death**
on games they can never play. The loop is browse three parody storefronts → buy cheap, ideally on
sale → run low → work a short shift that drains hours while it earns them → buy again. A shift is
~45 seconds at rest; holding a "Stare at the wall" control makes work-time run ~3x faster while
draining hours ~1.5x faster per unit of work, so zoning out gets you home sooner and costs more of
your life. New games
release during the run, so the "own everything" win condition is a treadmill that is explicitly not
required to be winnable (FR-047).

**Technical approach**: A pure client-side React SPA built with Vite, deployed to Vercel as static
files. No server, no API routes, no database, no accounts. The entire run lives in one `useReducer`
store mirrored to `localStorage`. All time-based behavior — shift drain, shift completion, sale
start/expiry, new releases — derives from wall-clock timestamps rather than accumulated ticks, so
reloading or closing the tab neither cheats the clock nor breaks state. Thumbnails are procedurally
generated SVG from each game's title hash, so there are no image assets and no licensing questions.

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**: React 19, Vite 7, Tailwind CSS 4 (via `@tailwindcss/vite`). No state
library, no router, no UI kit, no game engine, no animation library. All MIT/free.

**Storage**: Browser `localStorage`, single versioned key. No server-side persistence of any kind.

**Testing**: Manual verification per `quickstart.md` (constitution Principle V). Optionally Vitest
for the pure economy functions in `src/lib/economy.ts` only — the one place where checking in code
is genuinely faster than clicking.

**Target Platform**: Modern desktop browsers (Chrome/Firefox/Safari current). Mobile is best-effort,
not a requirement.

**Project Type**: Static single-page web application. Vercel serves prebuilt files; no serverless
function is ever invoked, which is what keeps hosting free.

**Performance Goals**: No meaningful performance demands. One ~100ms interval drives all timers
(fast enough that the spacing-out speed-up reads as smooth);
the catalogue is ~30 items. Target is simply that the UI never visibly stutters.

**Constraints**: Entirely offline-capable after first load. Zero network requests at runtime. Zero
recurring cost. No secrets, no user data, no analytics.

**Scale/Scope**: One player, one run, no concurrency. ~24 starting games plus a reserve pool of ~10
for releases, 3 storefronts, ~40 listings, 5 views (store / work / library / history / end).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.0.0.

| Principle | Status | Evidence |
|---|---|---|
| I. Working Software First | PASS | Build order (below) produces a running, playable app from step 2 onward; every later step adds to a thing that already runs. |
| II. Simplicity Over Structure | PASS | One reducer, no state library, no router, no service layer, no repository pattern, no component library. Data is a hand-authored TS constant. Abstractions deferred until a second use exists. |
| III. Shortcuts Allowed, Not Silent | PASS | Shortcuts are enumerated below and go into the README's `Known Gaps` section. |
| IV. Smallest Viable Scope | PASS | No accounts, no server, no multiplayer, no sound, no mobile target, no analytics — all explicitly out of scope in the spec. |
| V. Manual Verification Sufficient | PASS | `quickstart.md` is the scripted manual pass. Automated tests are limited to pure economy math, which the principle explicitly permits. |
| PoC Constraints (§ Proof-of-Concept Constraints) | PASS | One app, one process, one deployment target, framework defaults, no service at all (localStorage suffices), no secrets, no real user data. |

**Declared shortcuts** (Principle III requires these be named, not hidden):

1. Catalogue is a hand-authored TypeScript constant, not data-driven or CMS-backed.
2. Thumbnails are procedurally generated, not designed art.
3. No automated tests beyond optional economy math.
4. No error boundary or crash recovery beyond "clear localStorage and restart."
5. Economy values are first-guess numbers to be tuned by playing, not derived.
6. A player who edits their system clock or `localStorage` can cheat freely. Out of scope.

**Result**: No violations. Complexity Tracking section omitted as unused.

## Project Structure

### Documentation (this feature)

```text
specs/001-game-buy-simulator/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── ui-contract.md   # Phase 1 output — view/action contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
index.html
package.json
vite.config.ts
tsconfig.json
vercel.json                  # only if needed; Vite is auto-detected
README.md                    # includes the mandatory "Known Gaps" section

src/
├── main.tsx                 # React root
├── App.tsx                  # shell: hours header, view switcher, active view, toasts
├── index.css                # Tailwind entry + a few custom properties
├── data/
│   └── catalogue.ts         # games, storefronts, listings, sale names, release pool
├── lib/
│   ├── types.ts             # shared types (see data-model.md)
│   ├── economy.ts           # PURE: pricing, discounts, affordability, run totals
│   ├── gameReducer.ts       # PURE: state + actions (see contracts/ui-contract.md)
│   ├── timeEngine.ts        # PURE: wall-clock + spaced-out bonus → shift/sale/release resolution
│   ├── storage.ts           # localStorage load/save, versioned
│   ├── thumbnail.ts         # title hash → deterministic SVG
│   └── puzzles.ts           # puzzle generation + answer checking
└── components/
    ├── HoursHeader.tsx      # balance, shift status, collection progress
    ├── NavBar.tsx           # store / work / library / history switcher
    ├── StoreView.tsx        # storefront selector + listing grid
    ├── GameCard.tsx         # thumbnail, title, blurb, price, sale badge, buy
    ├── Thumbnail.tsx        # renders thumbnail.ts output
    ├── WorkView.tsx         # puzzle gate → countdown → payout
    ├── SpaceOutButton.tsx   # hold-to-accelerate, with rate readout
    ├── Puzzle.tsx
    ├── LibraryView.tsx
    ├── HistoryView.tsx
    ├── Announcement.tsx     # shared toast for sales AND new releases
    └── EndScreen.tsx        # death and victory share one component
```

**Structure Decision**: Single static SPA at the repository root. `src/lib/` holds pure logic with
no React imports — this is what makes the economy testable and the time engine replayable. `src/
components/` is presentational and reads from one context. There is no `services/`, `models/`, or
`api/` layer because there is no server and no second consumer; per Principle II those would be
structure ahead of need.

## Build Order

Each step leaves the app running and demonstrable.

1. **Scaffold** — Vite + React + TS + Tailwind, deploys to Vercel as-is.
2. **Catalogue + store view** — data, procedural thumbnails, one storefront grid, hours visible.
3. **Buying** — deduct, own, record history; refuse unaffordable and already-owned.
4. **Work shift** — puzzle gate, wall-clock countdown, live drain, wage on completion, single-shift
   lock, browsable while running.
4b. **Spacing out** — hold-to-accelerate control at 3x work-time and 1.5x drain per unit of work;
   snaps back on release, on blur, and on view change; never active while away.
5. **Persistence** — localStorage round-trip, including an in-progress shift and death-while-away.
6. **Sales** — random timing/subset/percentage, toast, badges, expiry, price floor, no stacking.
7. **Storefront switching** — three stores, shared balance and library.
8. **Library + history** — totals and empty states.
9. **End states** — death (including mid-shift and while away), victory, run stats, restart-anytime.
10. **New releases** — reserve pool, release toast, growing progress denominator.
11. **Tune + README** — play a full run, adjust numbers, write `Known Gaps`.

## Phase 0 / Phase 1 Artifacts

- [research.md](./research.md) — technology decisions and the wall-clock replay model
- [data-model.md](./data-model.md) — entities, state shape, transitions, persistence format
- [contracts/ui-contract.md](./contracts/ui-contract.md) — views, actions, and reducer contract
- [quickstart.md](./quickstart.md) — the manual verification pass required by Principle V

**Post-design constitution re-check**: PASS. The design added no new dependencies, no server, no
build-time services, and no abstraction with fewer than two uses. The one structural choice worth
noting — splitting pure logic in `src/lib/` away from components — earns its place by making the
time engine replayable and the economy checkable, which directly serves Principle V.
