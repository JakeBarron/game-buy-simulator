<!--
SYNC IMPACT REPORT
Version change: (unfilled template) → 1.0.0
Rationale: Initial ratification. All placeholder tokens replaced with concrete
  project-specific governance for a proof-of-concept effort.

Modified principles:
  [PRINCIPLE_1_NAME] → I. Working Software First
  [PRINCIPLE_2_NAME] → II. Simplicity Over Structure
  [PRINCIPLE_3_NAME] → III. Shortcuts Are Allowed, Silence Is Not
  [PRINCIPLE_4_NAME] → IV. Smallest Viable Scope
  [PRINCIPLE_5_NAME] → V. Manual Verification Is Sufficient

Added sections:
  Proof-of-Concept Constraints (was [SECTION_2_NAME])
  Development Workflow (was [SECTION_3_NAME])

Removed sections: none

Deferred TODOs: none
-->

# Game Buy Simulator Constitution

## Core Principles

### I. Working Software First

A running end-to-end path MUST exist before any part of it is refined. Every unit of
work MUST be judged by whether the thing runs and demonstrates the intended behavior,
not by how it is built internally. If a choice trades correctness of architecture for a
demonstrable result sooner, the demonstrable result wins.

Rationale: This project is a proof of concept. Its only product is evidence that the
idea works; unbuilt polish has no value.

### II. Simplicity Over Structure

The simplest implementation that satisfies the current requirement MUST be chosen.
Abstractions, interfaces, configuration layers, plugin systems, and generalized helpers
MUST NOT be introduced until at least two concrete uses exist. Hardcoded values, inline
data, and single-file modules are acceptable and preferred over premature structure.

Rationale: Structure added ahead of need is the largest source of slowdown in
short-lived projects.

### III. Shortcuts Are Allowed, Silence Is Not

Shortcuts — stubs, fake data, skipped error handling, in-memory state, copied code —
are explicitly permitted. Any shortcut that would surprise someone extending the
project MUST be recorded where it lives, as a brief inline comment or a line in the
project README. Shortcuts MUST NOT be presented as finished behavior when reporting
status.

Rationale: Speed comes from taking shortcuts; trust comes from naming them. Both are
required.

### IV. Smallest Viable Scope

Each change MUST implement only what was asked. Speculative features, unrequested
options, and "while we're here" refactors MUST be deferred. When a requirement is
ambiguous, the narrower reading MUST be implemented and the assumption stated.

Rationale: Scope growth, not technical difficulty, is what stalls a POC.

### V. Manual Verification Is Sufficient

Automated tests are OPTIONAL. Before work is reported complete, the change MUST be
exercised at least once — by running the app, hitting the route, or executing the
script — and the observed result MUST be stated. Claims of completion without an
observed run are NOT permitted. Tests MAY be added where they are genuinely faster than
manual checking (e.g. tricky pure logic).

Rationale: The evidence bar stays high while the ceremony stays low.

## Proof-of-Concept Constraints

- Default to the fewest moving parts: one app, one process, one deployment target.
- Prefer defaults of the chosen framework over custom configuration.
- Prefer managed or hosted services over self-built infrastructure; prefer no service
  at all over either, when in-memory or local state suffices for a demo.
- Persistence MAY be in-memory or file-based until a demo requires otherwise.
- Authentication, multi-user support, and access control are OUT OF SCOPE unless
  explicitly requested.
- Performance and scale work is OUT OF SCOPE unless a demo is visibly broken without it.
- Secrets MUST NOT be committed to the repository, and real user data MUST NOT be used.
  This constraint is not waivable by any speed argument.

## Development Workflow

- Formal code review is NOT required. Changes may be made and demonstrated directly.
- Planning artifacts (spec, plan, tasks) SHOULD stay short; a few bullets beat a
  document. Skip a phase outright when the work is obvious.
- Every reported completion MUST include what was run and what was observed
  (see Principle V).
- Known shortcuts and gaps MUST be discoverable in one place — a `Known Gaps` section
  in the README or equivalent.
- Broken main is acceptable mid-session; it MUST be working before the session's work
  is reported as done.

## Governance

This constitution supersedes conflicting process guidance for this project. Where a
practice from a general template or tool conflicts with a principle here, the principle
here wins.

Amendments: any amendment MUST be recorded by editing this file, updating the version
line, and updating the Sync Impact Report comment at the top. No approval process is
required beyond the project owner's decision.

Versioning policy follows semantic versioning:
- MAJOR: a principle is removed or redefined in a backward-incompatible way.
- MINOR: a principle or section is added, or guidance is materially expanded.
- PATCH: clarifications, wording, and non-semantic refinements.

Compliance review: compliance is self-checked at the point of reporting work complete.
The check is two questions — was the simplest thing built, and was it actually run? A
deliberate deviation is acceptable when it is stated in the same report.

This constitution is expected to be short-lived. When this project stops being a proof
of concept, it MUST be replaced rather than amended.

**Version**: 1.0.0 | **Ratified**: 2026-09-01 | **Last Amended**: 2026-09-01
