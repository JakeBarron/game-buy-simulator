# Phase 0 Research: Game Buy Simulator

All open technical questions were resolved directly with the user during `/speckit-plan`. No
`NEEDS CLARIFICATION` items remain.

## D1. UI approach — plain DOM/React, not a game engine

**Decision**: React 19 with regular DOM elements. No Phaser, PixiJS, or canvas.

**Rationale**: Despite being "a game," every screen in the spec is conventional application UI — a
scrollable card grid, a modal-ish work view, a countdown, a toast, two list views. There is no
sprite, no physics, no per-frame animation, and no 60fps requirement anywhere in the spec. React
gives text layout, scrolling, focus handling, and accessibility for free; in Phaser each of those
would be rebuilt by hand on canvas, and text-heavy layouts are exactly where canvas engines are
weakest.

**Alternatives considered**: Phaser 3 (free and mature, but wrong shape for a storefront UI, and
its scene system would duplicate the reducer's job); React plus an animation library such as Framer
Motion (rejected for now — CSS transitions cover the toast and purchase feedback, and Principle II
says don't add the dependency until something needs it).

## D2. Build tooling — Vite static SPA, not Next.js

**Decision**: Vite 7 + React + TypeScript, output as static files, deployed to Vercel.

**Rationale**: The user's constraint is "no server-side anything." Vite's build is a folder of
static assets, so Vercel serves it from the CDN and never invokes a serverless function — which is
both literally serverless and reliably free. Vite is also the fastest dev loop, which matters when
the verification pass is largely manual.

**Alternatives considered**: Next.js App Router (Vercel-native and the usual default, but every
component here would be a client component with no data fetching, so it means carrying a server
framework that does nothing — rejected under Principle II); vanilla TypeScript with no framework
(genuinely viable at this scale, but hand-rolled state→DOM syncing is where the bugs would come
from, and the reducer pattern is worth more than the ~45KB React costs).

## D3. Styling — Tailwind CSS 4

**Decision**: Tailwind via `@tailwindcss/vite`, with a small set of CSS custom properties for each
storefront's identity colors.

**Rationale**: Three storefronts must look visibly distinct (SC-008), which means a lot of small
styling decisions made quickly. Tailwind is free, has no runtime, and adds one build plugin.
Per-storefront theming is a handful of CSS variables swapped at the storefront container.

**Alternatives considered**: Plain CSS modules (fewer dependencies, but slower to iterate on three
distinct visual identities); shadcn/ui (a component library is structure ahead of need here — the
app has roughly six bespoke components and no forms).

## D4. Thumbnails — procedurally generated SVG

**Decision**: A deterministic hash of each game's title seeds a gradient pair, a geometric motif,
and a glyph, rendered as inline SVG by `src/lib/thumbnail.ts`.

**Rationale**: Zero image files, zero network requests, zero licensing risk, and zero repo weight.
Determinism means a given game always looks the same across runs and reloads, and games added later
via the release pool get art automatically with no asset prep. It also keeps the app fully offline.

**Alternatives considered**: Emoji on colored tiles (simpler, but reads as placeholder and renders
inconsistently across platforms); AI-generated box art committed as static assets (best-looking, but
adds repo weight and requires art prepared ahead for every future release — rejected as premature).

## D5. Time model — wall clock, replayed on load

**Decision**: Every time-based behavior derives from stored absolute timestamps compared against
`Date.now()`. Nothing accumulates ticks.

**Rationale**: This is the single most important technical decision in the project, because three
separate requirements depend on it: FR-020 (reload must neither skip nor restart the wait),
backgrounded tabs (browsers throttle `setInterval` to ~1/minute in background tabs, so an
accumulator would silently under-count and a shift would never finish), and the user's choice that a
closed tab still completes a shift.

The interval (~100ms) exists only to trigger re-renders. It never computes baseline state by adding
to a counter — it asks the pure functions in `timeEngine.ts` "given these timestamps, what is true
now?" That makes the time system replayable from persisted state, which is what allows the app to
correctly resolve events that happened while the tab was closed.

**Alternatives considered**: Accumulating elapsed time per tick (breaks under background throttling
and reload); `visibilitychange`-gated pausing (rejected by the user's answer, and would need
accumulated bookkeeping anyway); Web Workers to keep timers alive (unnecessary once state is derived
from timestamps rather than ticks).

## D6. Resolving events that happened while away

**Decision**: On load, and on every tick, resolve in a fixed order: (1) shift drain and possible
death, (2) shift completion and wage, (3) sale expiry, (4) new sale roll, (5) new release roll,
(6) victory check.

**Rationale**: A player can close the tab mid-shift and return much later, so the app must
reconstruct what happened rather than assume it was watching. The ordering matters in two places
the spec calls out:

- **Death during a shift takes precedence over the wage** (FR-039). Given `balanceAtShiftStart` and
  the drain rate, the moment of death is computable: if `balanceAtShiftStart < drainRate ×
  shiftDuration`, the player died partway through and the wage is never paid — regardless of how
  long ago the tab was closed.
- **Victory resolves before a new release** (Edge Cases), so a player is not robbed of a win by a
  release landing in the same tick.

Drain is bounded by the shift duration, so time spent away *beyond* the shift's length costs
nothing. A player who closes the tab therefore ends up with exactly the same balance as one who
watched — consistent, and it avoids punishing people for leaving.

**Alternatives considered**: Resolving only the most recent event (loses shifts entirely across long
absences); simulating every intermediate tick since the last visit (needlessly expensive and
identical in outcome for this economy).

## D6b. Combining wall-clock time with player-driven acceleration

**Decision**: Shift progress is `workMs = (now - startedAt) + bonusMs`, where `bonusMs` is the extra
work-time earned by spacing out. `bonusMs` accumulates only while the control is actively held, at
2ms of bonus per 1ms held (giving the 3x total rate). Hours drained are computed as
`RATE × wallMs + 1.5 × RATE × bonusMs`.

**Rationale**: This is the one place accumulation is unavoidable — how long someone held a button is
not derivable from two timestamps. Splitting the two sources keeps the guarantee that matters: the
**baseline stays pure wall clock**, so reload, backgrounding, and a closed tab still resolve exactly
as in D5, and only the bonus is accumulated.

Accumulating the bonus is safe precisely because holding the control requires a focused tab and the
work view — the situation where `setInterval` is *not* throttled. Time spent away can never earn
bonus, which is also what makes FR-056 true by construction rather than by enforcement.

Storing `bonusMs` also keeps the drain honest across a reload: because the wall and bonus portions
are drained at different rates, the split has to persist, not just the total.

**Alternatives considered**: a single accumulated `workMs` counter (loses D5's throttle- and
close-safety); recording every hold as a start/stop interval list (exact, but unbounded state for no
gain over a single accumulator); applying the higher drain rate to the whole shift once the player
spaces out at all (simpler, but punishes a one-second hold as much as a full shift).

## D7. Persistence — one versioned localStorage key

**Decision**: The whole run serializes to a single JSON blob under one key carrying a schema
version. On load, a version mismatch discards the save and starts a fresh run.

**Rationale**: The state is small and always read and written as a unit, so splitting it across keys
would buy nothing. The version field is the cheapest possible protection against a shape change
crashing on an old save — during active development the shape will change often, and "reset on
mismatch" is one line and always correct for a POC with no data worth migrating.

**Alternatives considered**: IndexedDB (unnecessary — the data is a few kilobytes and needs no
querying); per-entity keys (more code, no benefit); migration logic (structure ahead of need — this
is a POC where discarding a save costs nothing).

## D8. Testing posture

**Decision**: Manual verification via `quickstart.md` is the primary gate. Vitest is added only for
the pure functions in `economy.ts` and `timeEngine.ts`, and only if manual checking proves fiddly.

**Rationale**: The constitution makes tests optional but an observed run mandatory. The economy
arithmetic (SC-006) and the wall-clock replay (D6) are the two places where a bug is both likely and
invisible in the UI, and both are pure functions — testing them takes minutes and beats
repeatedly holding a button through shifts with a stopwatch. Everything else is faster to check by
clicking.

## D9. Shift length and the spacing-out mechanic

**Decision**: A shift is **45 seconds of work-time** at rest, not 5 real minutes. Holding a "Stare at
the wall" control advances work-time at **3x** while held, and drains hours at **1.5x per unit of
work-time** while accelerated. A fully spaced-out shift therefore finishes in ~15 real seconds and
costs ~360 hours instead of ~270, against a flat ~600 wage.

**Rationale**: The 5-minute wait was pacing, not comedy. The joke that actually works is that
*competence buys you nothing* — solving the puzzle faster still changes nothing — while
*disengaging* is the only thing that makes work pass. Shortening the shift makes the loop testable
and playable; the hold-to-space-out control puts the speed-up behind a deliberate, continuous act
rather than a fast-forward button.

Making acceleration cost extra hours is what keeps it a decision. If spacing out were free, there
would be no reason not to hold it for every second of every shift, and it would collapse into a skip
button with a funny label. Charging life for it means the player trades wall-clock patience against
hours-till-death, which is the game's whole thesis stated as a mechanic.

**Constraints this creates** (see D5b): spacing out must require the tab focused and the work view
active, must not latch, and must never apply to time spent away.

**Alternatives considered**: click-to-zone-out (rewards mashing — wrong message, since effort should
not be what saves you); a toggle (latches, so it is never turned off); escalating idle states —
stare, daydream, dissociate (funniest option, kept on the shelf as a later addition since it is
several states to build and tune); free acceleration (collapses into a skip button); a
random "manager catches you" penalty (losing a completed shift's wage feels bad and adds a failure
state for no thematic gain).

## D9b. Development ergonomics — dev-only time compression

**Decision**: A dev-only `?fast` query parameter (ignored in production builds) shortens the sale and
release intervals only. Shift length no longer needs compression.

**Rationale**: At 45 seconds a shift is directly testable, so the risky shortcut — compressing the
very timer the feature is about — is gone. Sales and releases are still minutes apart, and waiting
those out repeatedly during development is pure dead time with nothing to learn from it.
