<!--
SYNC IMPACT REPORT
Version change: 1.0.0 → 2.0.0
Rationale: MAJOR. The proof-of-concept phase is over. Every principle in v1.0.0 was
  written to favour speed over rigour, and three of them are now redefined in
  backward-incompatible ways: shortcuts are no longer freely permitted, automated tests
  are no longer optional for pure logic, and "smallest viable scope" no longer licenses
  deferring quality work. v1.0.0 anticipated this: it required replacement rather than
  amendment once the project stopped being a POC. This is that replacement.

Modified principles:
  I. Working Software First          → I. Demonstrated Correctness
  II. Simplicity Over Structure      → II. Simplicity That Earns Its Keep
  III. Shortcuts Are Allowed...      → IV. Refactor In Place (inverted: shortcuts are now debt to repay)
  IV. Smallest Viable Scope          → (removed as a principle; scope discipline folded into Governance)
  V. Manual Verification Is Enough   → I. Demonstrated Correctness (raised: pure logic MUST be tested)

Added principles:
  III. Performance Is a Feature
  V. Responsive By Default

Added sections:
  Engineering Standards (replaces Proof-of-Concept Constraints)

Removed sections:
  Proof-of-Concept Constraints — its permissions (no auth, no scale work, in-memory state)
  are retained as scope facts in Governance, but they are no longer blanket exemptions.

Deferred TODOs: none
-->

# Game Buy Simulator Constitution

## Core Principles

### I. Demonstrated Correctness

Claims of completion MUST rest on observed evidence, never on inspection of the code alone.

- Pure logic — anything in `src/lib/` with no React or DOM dependency — MUST have automated
  tests. The economy, the time engine, and the reducer decide what the player's balance is;
  a silent error there is invisible in the UI and corrupts a run.
- UI and interaction MUST be verified by running the app and observing the result. A
  screenshot, a state dump, or a measured number is evidence. "It should work" is not.
- Any change to time, money, or persistence MUST be re-verified across a reload before it is
  called done.

Rationale: The two worst defects found during the POC — drain lost across a closed tab, and a
catalogue cheaper than the starting balance — were both invisible in the code and obvious the
moment someone measured. Measurement is the cheapest bug-finding tool available.

### II. Simplicity That Earns Its Keep

The simplest implementation that satisfies the requirement MUST be chosen, and simplicity is
judged over the life of the code, not at the moment of writing.

- Abstractions MUST NOT be introduced before a second real use exists.
- Duplicated logic, once it appears a second time, MUST be consolidated rather than copied
  again.
- Pure logic MUST stay free of React, `Date.now()`, `Math.random()`, and storage access;
  time and entropy are injected by callers. This is what keeps the system testable and
  replayable, and it is not negotiable for convenience.
- Dependencies MUST be justified by something the project cannot reasonably do itself.

Rationale: Premature abstraction and accumulated duplication fail the same way — both make the
next change more expensive than the last.

### III. Performance Is a Feature

The game MUST feel immediate. Perceived responsiveness is part of the product, not a
follow-up task.

- Interactions MUST respond within one frame of user input. Nothing that runs on a click,
  a hold, or a tick may block the main thread.
- Per-tick work MUST stay proportional to what changed, not to the size of the catalogue.
  Derived values that are expensive to compute MUST be memoized on their real inputs.
- Re-renders MUST be confined to the components whose data actually changed. A ticking
  counter MUST NOT re-render the storefront grid.
- Performance claims MUST be measured, not asserted. "Faster" without a number is not a
  finding.
- Bundle size MUST be treated as a budget. A dependency that costs more than the problem it
  solves MUST be rejected.

Rationale: This is a game about a clock running down. If the clock stutters, the premise
stops working.

### IV. Refactor In Place

When code that could be better is encountered while doing other work, it MUST be improved
then and there, not recorded for later.

- Improvements MUST NOT be deferred into issues, TODOs, or backlog entries. A TODO comment
  describing work the author could have done is not acceptable.
- Refactors MUST be behaviour-preserving unless a behaviour change is the point, and MUST be
  verified under Principle I before being called done.
- A refactor that grows beyond the change that prompted it MUST be raised with the user
  rather than expanded silently.
- The `Known Gaps` section of the README is a debt register, not a permanent excuse. Entries
  MUST be removed as they are repaid, and MUST NOT be used to justify leaving new problems
  behind.

Rationale: Deferred cleanup is never cheaper later, and a backlog of known-bad code is
indistinguishable from code nobody understands.

### V. Responsive By Default

Every component MUST be built for small screens at the same time as large ones, never
retrofitted afterwards.

- Layouts MUST work from a 360px-wide viewport upward without horizontal page scrolling.
  Wide content — grids, tables, long rows — MUST scroll within its own container.
- Touch targets MUST be large enough to hit reliably, and any hold, drag, or hover
  interaction MUST have a working touch equivalent. Behaviour that exists only on hover is
  not acceptable as the sole affordance.
- Text and spacing MUST scale with relative units so the layout survives user font settings.
- Responsive behaviour MUST be verified at a small viewport before a component is called
  done, not assumed from utility classes.

Rationale: Retrofitting mobile is a rewrite of the layout with the deadline already spent.
Building both at once costs almost nothing.

## Engineering Standards

- **Typing**: TypeScript strict mode stays on. `any` MUST NOT be introduced; an unavoidable
  escape hatch MUST be narrowed and commented. The build MUST typecheck clean.
- **Purity boundary**: `src/lib/` holds pure logic and MUST NOT import React or components.
  `src/components/` holds presentation and MUST remain props-driven. State lives in the
  reducer.
- **State**: the reducer stays the single source of truth for a run. Component state is for
  ephemeral UI concerns only — input values, open/closed, transient feedback.
- **Persistence**: any change to persisted shape MUST bump the schema version. Storage
  failures MUST NOT break gameplay.
- **Accessibility**: interactive elements MUST be real controls with accessible names.
  Disabled states MUST use the `disabled` attribute and say why they are disabled.
- **Dead code**: unused exports, files, assets, and commented-out blocks MUST be deleted
  rather than left in place.
- **Secrets and data**: no secrets in the repository, and no real user data. Unchanged from
  v1.0.0 and still not waivable.

## Development Workflow

- Formal review is not required, but every change MUST satisfy Principle I before it is
  reported complete.
- Definition of done for a change: it typechecks, it builds, its pure logic is tested, it has
  been run and observed, and it has been looked at on a small viewport.
- Every completion report MUST state what was run and what was observed, including numbers
  where numbers are the point.
- Failures, skipped steps, and partial work MUST be reported plainly. A step that was not
  verified MUST be described as unverified rather than implied to be working.
- `main` MUST be working at the end of a session. Mid-session breakage is acceptable.

## Governance

This constitution supersedes conflicting process guidance for this project. Where a practice
from a general template or tool conflicts with a principle here, the principle here wins.

Amendments: any amendment MUST be recorded by editing this file, updating the version line,
and updating the Sync Impact Report at the top. No approval process is required beyond the
project owner's decision.

Versioning policy follows semantic versioning:
- MAJOR: a principle is removed or redefined in a backward-incompatible way.
- MINOR: a principle or section is added, or guidance is materially expanded.
- PATCH: clarifications, wording, and non-semantic refinements.

Compliance review: compliance is self-checked at the point of reporting work complete. The
check is four questions — was the simplest thing built, was it measured, does it hold up on a
small screen, and was anything left worse than it was found. A deliberate deviation is
acceptable only when stated in the same report.

Scope: this remains a single-player, client-side game with no server, no accounts, and no real
user data. That is a property of the product, not a licence to skip the principles above.

**Version**: 2.0.0 | **Ratified**: 2026-09-01 | **Last Amended**: 2026-09-02
