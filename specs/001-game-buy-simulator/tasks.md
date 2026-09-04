---

description: "Task list for Game Buy Simulator implementation"
---

# Tasks: Game Buy Simulator

**Input**: Design documents from `/specs/001-game-buy-simulator/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contract.md, quickstart.md

**Tests**: Automated tests are OPTIONAL per constitution Principle V. Only two optional test tasks
appear (T054, T055), covering the pure economy and time math the constitution explicitly permits.
Everything else is verified by the manual pass in `quickstart.md`.

**Organization**: Tasks are grouped by user story so each is independently implementable and
demonstrable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US7)
- Exact file paths are included in every task

## Path Conventions

Single static SPA at the repository root: `src/`, `index.html`, `package.json`. There is no
`backend/`, no `api/`, and no `tests/` directory unless the optional test tasks are taken.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository, scaffold, and a verified deployment path before any game logic exists

- [X] T001 Create the GitHub repository with `gh repo create JakeBarron/game-buy-simulator --public --description "A browser game about spending your remaining hours on games you will never play"` (run from `/Users/jake/dev/game-buy-simulator`; `gh` is already authenticated as JakeBarron)
- [X] T002 Initialize git in `/Users/jake/dev/game-buy-simulator`, add `.gitignore` (node_modules, dist, .vercel, .DS_Store), commit the existing `.specify/` and `specs/` design documents, and push to `origin main`
- [X] T003 Scaffold the app at the repository root with `npm create vite@latest . -- --template react-ts`, keeping the existing `.specify/`, `.claude/`, and `specs/` directories intact
- [X] T004 Add Tailwind CSS 4 via `@tailwindcss/vite` in `vite.config.ts` and `@import "tailwindcss"` in `src/index.css`
- [X] T005 [P] Create `README.md` with a one-paragraph description, run/build/deploy commands, and an empty `## Known Gaps` section (required by constitution Principle III)
- [ ] T006 ⛔ BLOCKED (Vercel CLI not installed; needs `npm i -g vercel` + interactive `vercel login`) Deploy the untouched scaffold with `vercel deploy` to confirm static hosting works end to end before any game code exists, and record the URL in `README.md`

**Checkpoint**: A blank React app is on GitHub and live on Vercel.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, data, pure logic, and the app shell every user story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Define all shared types in `src/lib/types.ts` per `data-model.md`: `Game`, `Storefront`, `Listing`, `RunState`, `Shift`, `Puzzle`, `Sale`, `PurchaseRecord`, `Announcement`
- [X] T008 [P] Create `src/lib/config.ts` with the tuning constants from `data-model.md`: `STARTING_HOURS` 1500, `WORK_REQUIRED_MS` 45000, `DRAIN_PER_WORK_MS` 0.006, `SPACE_TIME_MULT` 3, `SPACE_DRAIN_MULT` 1.5, `WAGE` 600, `MIN_PRICE`, sale and release interval ranges, and a `?fast` dev override that compresses sale/release intervals only (never shift length)
- [X] T009 [P] Implement deterministic procedural art in `src/lib/thumbnail.ts`: hash a game id into a gradient pair, geometric motif, and glyph, returned as inline SVG props (research D4)
- [X] T010 Author `src/data/catalogue.ts`: 3 storefronts with distinct names/taglines/theme colors, ~24 starting games plus ~10 `releasePool` games with invented titles and blurbs, listings spreading games across 1–3 storefronts at differing prices, and a pool of ~15 sale names mixing plausible and absurd reasons
- [X] T011 Implement pure selectors in `src/lib/economy.ts`: `currentPrice`, `canAfford`, `isOwned`, `availableGameIds`, `collectionProgress`, `restingShiftCost`, `spacedShiftCost`, `currentDrainRate`, `runStats` (no React, no `Date.now()`, no randomness)
- [X] T012 Implement pure time resolution in `src/lib/timeEngine.ts`: compute `wallMs`, `bonusMs`, `workMs`, `remaining`, and the split drain `DRAIN × wallMs + SPACE_DRAIN_MULT × DRAIN × bonusMs` per research D6b
- [ ] T013 Implement `src/lib/gameReducer.ts` with the action surface from `contracts/ui-contract.md` (`BUY`, `START_SHIFT`, `SOLVE_PUZZLE`, `SET_SPACING_OUT`, `TICK`, `DISMISS_ANNOUNCEMENT`, `SET_STOREFRONT`, `RESTART`), keeping it pure with `now`/`dt`/randomness injected, and implementing the normative `TICK` resolution order (bonus accrual → drain/death → completion → sale expiry → sale roll → release roll → victory check)
- [X] T014 Implement `src/lib/storage.ts`: load/save the whole `RunState` to `localStorage["gbs.run.v1"]`, discarding the save on missing, malformed, or version-mismatched data, and always restoring `spacingOut` as `false`
- [ ] T015 Build the app shell in `src/App.tsx`: reducer + context provider, a ~100ms `TICK` interval, view switching state, and a load path that replays elapsed time through `TICK` **before first render**
- [X] T016 [P] Create `src/components/HoursHeader.tsx` showing `hoursRemaining` to one decimal, active-shift remaining time, collection progress, and the current drain rate
- [X] T017 [P] Create `src/components/NavBar.tsx` switching between store / work / library / history in a single action (SC-007)

**Checkpoint**: State, persistence, and the shell exist. User stories can now proceed.

---

## Phase 3: User Story 1 - Browse and Buy Games (Priority: P1) 🎯 MVP

**Goal**: A storefront of games that can be bought with hours-till-death

**Independent Test**: Load the game, buy a game, confirm the balance drops by the listed price and the game shows as owned

- [X] T018 [P] [US1] Create `src/components/Thumbnail.tsx` rendering the SVG produced by `src/lib/thumbnail.ts`
- [X] T019 [US1] Create `src/components/GameCard.tsx` showing thumbnail, title, blurb, and price, with a buy control that is disabled with a visible reason when unaffordable and replaced by an `Owned` indicator when owned (FR-005, FR-009, FR-010)
- [X] T020 [US1] Create `src/components/StoreView.tsx` rendering the listing grid for the active storefront, including an all-owned empty state
- [ ] T021 [US1] Wire the `BUY` action in `src/lib/gameReducer.ts` to deduct the current price, add to `ownedGameIds`, and append a `PurchaseRecord` with list price, price paid, discount, and timestamp (FR-011, FR-012)
- [X] T022 [US1] Add immediate visual purchase feedback in `src/components/GameCard.tsx` (FR-013)

**Checkpoint**: The game is playable — browse and buy until you run out. Run quickstart steps 1–3.

---

## Phase 4: User Story 2 - Work a Shift to Earn Hours (Priority: P1)

**Goal**: Close the loop — a 45-second shift that drains hours as it earns them, plus the spacing-out speed-up

**Independent Test**: Solve the puzzle instantly and confirm the shift still takes its full time; then hold the spacing-out control and confirm it finishes ~3x faster while costing more hours

- [X] T023 [P] [US2] Implement `src/lib/puzzles.ts` generating the three trivial puzzle kinds (`arithmetic`, `match-shape`, `type-word`) with trimmed case-insensitive answer checking (FR-015, SC-004)
- [X] T024 [US2] Create `src/components/Puzzle.tsx` presenting a puzzle, rejecting wrong answers with feedback and no penalty, and allowing unlimited retries (FR-016)
- [ ] T025 [US2] Wire `START_SHIFT` and `SOLVE_PUZZLE` in `src/lib/gameReducer.ts`, recording `puzzleSolvedAt` with **no effect** on `workRequiredMs`, and enforcing one shift at a time (FR-017, FR-019)
- [ ] T026 [US2] Implement shift drain, completion, and wage payment in the `TICK` handler of `src/lib/gameReducer.ts`, paying the wage only on completion and never partially (FR-018, FR-036, FR-037)
- [X] T027 [US2] Create `src/components/WorkView.tsx`: puzzle gate, countdown, live-falling balance, and the shift's hour cost shown both at rest and spaced out **before** committing (FR-038, FR-040, FR-049)
- [X] T028 [US2] Create `src/components/SpaceOutButton.tsx`: a hold-to-activate control dispatching `SET_SPACING_OUT`, that cannot latch or be automated, and that releases on pointer-up, window blur, and view change (FR-051, FR-053, FR-055)
- [ ] T029 [US2] Implement `bonusMs` accrual in the `TICK` handler of `src/lib/gameReducer.ts` at `SPACE_TIME_MULT` with drain at `SPACE_DRAIN_MULT`, capped so work-time cannot exceed `workRequiredMs` (FR-051, FR-052, research D6b)
- [ ] T030 [US2] Keep the shift running across navigation in `src/App.tsx`, with remaining time visible from every view, and ensure no bonus accrues while the tab is closed or backgrounded (FR-021, FR-056)

**Checkpoint**: The core loop is complete and demonstrable. Run quickstart steps 6, 6b, 6c, 6d, 7.

---

## Phase 5: Persistence Integration (Cross-Story, blocks US6/US7 verification)

**Goal**: The run survives reload, backgrounding, and a fully closed tab

- [ ] T031 Wire `src/lib/storage.ts` into `src/App.tsx` to save the whole run on every state change and load it on boot
- [ ] T032 Verify wall-clock replay in `src/lib/timeEngine.ts` and `src/App.tsx` resolves a shift that completed while the tab was closed, and that the baseline/bonus drain split survives a reload (quickstart steps 8, 8b)

**Checkpoint**: Progress persists correctly. Run quickstart steps 8 and 8b.

---

## Phase 6: User Story 3 - Sales and Announcements (Priority: P2)

**Goal**: Randomized sales with on-screen announcements and discounted prices

**Independent Test**: Wait for a sale, confirm the announcement, badges, and struck-through prices, and that buying deducts the sale price

- [ ] T033 [US3] Implement sale rolling and expiry in the `TICK` handler of `src/lib/gameReducer.ts`: randomized interval, randomized subset of listings, randomized percentage, bounded duration, price floor, and no stacking (FR-022, FR-025, FR-027, FR-028)
- [X] T034 [P] [US3] Create `src/components/Announcement.tsx` as a shared toast for sale and release events, auto-dismissing after a few seconds and manually dismissible (FR-023, FR-024)
- [X] T035 [US3] Add discount badge, struck-through original price, and sale price to `src/components/GameCard.tsx` (FR-026)
- [ ] T036 [US3] Confirm `currentPrice` in `src/lib/economy.ts` applies the active discount at the moment of purchase and respects `MIN_PRICE` (FR-011, FR-028)

**Checkpoint**: Sale-hunting is now a strategy. Run quickstart step 10.

---

## Phase 7: User Story 4 - Multiple Storefronts (Priority: P2)

**Goal**: Three visually distinct stores sharing one balance and library

**Independent Test**: Cycle all three stores and confirm distinct catalogues and branding with an unchanged balance and library

- [X] T037 [US4] Add a storefront selector to `src/components/StoreView.tsx` dispatching `SET_STOREFRONT` (FR-007)
- [X] T038 [US4] Apply per-storefront theming via CSS custom properties from `src/data/catalogue.ts` so each store is distinguishable at a glance (FR-006, SC-008)
- [ ] T039 [US4] Verify a game owned on one storefront shows as `Owned` on the others and cannot be re-purchased (FR-009)

**Checkpoint**: Comparison shopping works. Run quickstart steps 4 and 5.

---

## Phase 8: User Story 5 - Library and Purchase History (Priority: P3)

**Goal**: See what you own and what it cost you

**Independent Test**: Buy several games across stores, then confirm the library and history list them all with correct prices and totals

- [X] T040 [P] [US5] Create `src/components/LibraryView.tsx` listing owned games with title and thumbnail, plus an empty state (FR-029)
- [X] T041 [P] [US5] Create `src/components/HistoryView.tsx` listing transactions chronologically with game, storefront, price paid, discount, and timestamp, plus an empty state (FR-030)
- [X] T042 [US5] Show the running total of hours spent on games in `src/components/HistoryView.tsx` (FR-031)

**Checkpoint**: The satire has its receipt. Run quickstart step 13.

---

## Phase 9: User Story 6 - Running Out of Time (Priority: P3)

**Goal**: Death, run statistics, and restart

**Independent Test**: Spend to zero and confirm the game-over screen with accurate stats, then restart into a fresh run

- [ ] T043 [US6] Implement the death transition in `src/lib/gameReducer.ts` for both purchase-driven and shift-drain-driven zero balance, ensuring the wage is never paid when death occurs mid-shift (FR-003, FR-039)
- [X] T044 [US6] Create `src/components/EndScreen.tsx` handling the death variant with games bought, hours spent, and shifts worked, blocking all purchases and shifts (FR-032)
- [ ] T045 [US6] Wire `RESTART` in `src/lib/gameReducer.ts` and expose it from both `src/components/EndScreen.tsx` and `src/components/NavBar.tsx`, so a run can be abandoned at any time (FR-033, FR-050)
- [ ] T046 [US6] Add the "you can no longer afford a shift" warning to `src/components/HoursHeader.tsx`, including the note that spacing out raises the cost (FR-046, FR-049)

**Checkpoint**: The lose condition gives the currency meaning. Run quickstart steps 9, 9b, 15, 16.

---

## Phase 10: User Story 7 - The Backlog Outruns You (Priority: P3)

**Goal**: New releases grow the catalogue; the nominal victory exists but is not required to be reachable

**Independent Test**: Play until a release lands and confirm it is announced and the progress denominator grows; separately, buy out the catalogue to see the victory screen

- [ ] T047 [US7] Implement release rolling in the `TICK` handler of `src/lib/gameReducer.ts`, drawing from the `releasePool` at full price and stopping when exhausted (FR-045, FR-047)
- [ ] T048 [US7] Emit a `release`-kind announcement through `src/components/Announcement.tsx` when a game releases (FR-046)
- [ ] T049 [US7] Show collection progress as owned-out-of-available in `src/components/HoursHeader.tsx`, with a denominator that grows on release (FR-044)
- [ ] T050 [US7] Implement the victory transition in `src/lib/gameReducer.ts`, resolved **before** a release can land in the same tick, and add the victory variant to `src/components/EndScreen.tsx` (FR-042, FR-043)

**Checkpoint**: All seven user stories are functional. Run quickstart step 11.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T051 Play one complete run and tune the values in `src/lib/config.ts` so the buy/work rhythm feels right; completion is explicitly not a balancing target (FR-047)
- [ ] T052 Verify the balance audit `hoursRemaining === STARTING_HOURS − Σ(pricePaid) − hoursDrained + hoursEarned` holds after shifts mixing resting and spaced-out time (SC-006, quickstart step 14)
- [ ] T053 Fill in the `## Known Gaps` section of `README.md` with the six declared shortcuts from `plan.md` (hand-authored catalogue, procedural art, no component tests, no crash recovery beyond clearing storage, untuned economy, trivially cheatable via devtools)
- [ ] T054 [P] OPTIONAL: Add Vitest cases for `src/lib/economy.ts` covering discount application, the price floor, and affordability boundaries
- [ ] T055 [P] OPTIONAL: Add Vitest cases for `src/lib/timeEngine.ts` covering the mixed resting/spaced drain split, death-while-away resolution, and a `TICK` spanning an entire shift
- [ ] T056 Run the full `quickstart.md` verification pass and record what was observed for each step (constitution Principle V)
- [ ] T057 Run `npm run build && npm run preview`, re-verify quickstart steps 2, 6, 6b, and 8 against the built output, and confirm `?fast` has no effect in production (SC-009)
- [ ] T058 Verify the game works offline with the network disabled (quickstart step 19)
- [ ] T059 Deploy to production with `vercel deploy --prod` and update the URL in `README.md`

---

## Phase 12: Post-POC Verification Debt

- [ ] T060 Verify the death end screen actually renders when a run reaches `status: 'dead'`, and investigate the unexplained run-restart observed after a death during live testing. Trace `src/App.tsx` (EndScreen render condition), `src/components/EndScreen.tsx`, and the death path in `src/lib/gameReducer.ts`. Fix in place if a defect is found (constitution v2.0.0, Principle IV).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)** and **US2 (Phase 4)**: Both depend only on Foundational. Both are P1; together they are the MVP
- **Persistence (Phase 5)**: Depends on US2 (there must be a shift to persist). Blocks meaningful verification of US6 and US7
- **US3, US4 (Phases 6–7)**: Depend on US1 (they modify the store and game card)
- **US5 (Phase 8)**: Depends on US1 (needs purchase history to display)
- **US6 (Phase 9)**: Depends on US1 and US2 (both routes to death)
- **US7 (Phase 10)**: Depends on US1 and Foundational catalogue work
- **Polish (Phase 11)**: Depends on everything intended for release

### Within Each User Story

- Pure logic (`src/lib/`) before components that consume it
- Reducer actions before the UI that dispatches them
- Story complete and demonstrable before moving to the next priority

### Parallel Opportunities

- T008 and T009 run in parallel with each other after T007
- T016 and T017 run in parallel (different component files)
- T018 runs in parallel with reducer work in US1
- T023 runs in parallel with T024–T027 setup
- T034 runs in parallel with T033 (component vs. reducer)
- T040 and T041 run in parallel (different component files)
- T054 and T055 run in parallel (different test files)
- Once Foundational completes, US3/US4/US5 could be split across people, though all touch `GameCard.tsx` or `StoreView.tsx` — coordinate those two files

---

## Parallel Example: Phase 2 Foundational

```bash
# After T007 (types) completes, launch together:
Task: "Create tuning constants in src/lib/config.ts"
Task: "Implement procedural thumbnails in src/lib/thumbnail.ts"

# After T015 (app shell) completes, launch together:
Task: "Create src/components/HoursHeader.tsx"
Task: "Create src/components/NavBar.tsx"
```

---

## Implementation Strategy

### MVP (Phases 1–4)

The MVP is **both P1 stories**, not just US1. US1 alone is a store where you spend down and then
have nothing to do; the loop only exists once shifts are in.

1. Phase 1: Setup — repo live on GitHub and Vercel
2. Phase 2: Foundational — types, data, pure logic, shell
3. Phase 3: US1 — browse and buy
4. Phase 4: US2 — work shifts and spacing out
5. **STOP and VALIDATE**: quickstart steps 1–7, 6b–6d. This is a complete, funny, playable game
6. Deploy and demo

### Incremental Delivery

1. MVP above → deploy
2. Phase 5 persistence → the run survives a reload → deploy
3. US3 sales → buying becomes strategic → deploy
4. US4 storefronts → comparison shopping → deploy
5. US5 library/history → the receipt → deploy
6. US6 end states → the currency means something → deploy
7. US7 releases → the backlog outruns you → deploy

Each step leaves the game playable, per constitution Principle I.

---

## Notes

- `[P]` tasks touch different files with no incomplete dependencies
- Commit after each task or logical group; the repo exists from T001 onward
- Keep `src/lib/` free of React imports — purity is what makes the time model verifiable
- Do not add abstractions until a second use exists (constitution Principle II)
- Report completion only with an observed run (constitution Principle V)
