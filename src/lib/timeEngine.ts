// Pure time-model functions for an active work Shift.
//
// See specs/001-game-buy-simulator/research.md sections D5, D6, D6b, and the
// Shift section of data-model.md — this file is a direct implementation of
// those decisions and should not diverge from them.
//
// WHY TWO NUMBERS INSTEAD OF ONE COUNTER
// ---------------------------------------------------------------------------
// A shift's work-time comes from two sources that behave completely
// differently under reload/backgrounding/a closed tab (research D5):
//
//   - BASELINE ("wallMs") is derived, never stored: `now - shift.startedAt`.
//     It is pure wall-clock elapsed time, so it is correct after any gap —
//     reload, a throttled background tab, or a tab closed for hours — with
//     zero bookkeeping. This is what makes the whole time system replayable
//     from persisted state alone.
//
//   - BONUS ("bonusMs") is extra work-time bought by holding the
//     "spacing out" control. How long a control was held is NOT derivable
//     from two timestamps (research D6b), so it is the one place
//     accumulation is unavoidable: `bonusMs` is a stored counter that grows
//     only while `spacingOut` is true, via `accrueBonus`. This is safe
//     specifically because spacing out requires a focused tab and the work
//     view — exactly the situation where `setInterval` ticks are not
//     throttled — so time spent away can never contribute bonus.
//
// A future reader may be tempted to "simplify" this into one accumulated
// `workMs` counter. DO NOT. That would break reload/backgrounding for the
// baseline portion (D5) and, separately, it would lose the fact that the two
// portions drain hours at DIFFERENT rates (baseline at the resting rate,
// bonus at `SPACE_DRAIN_MULT` times the resting rate — D6b). Losing that
// split corrupts the player's balance the moment a shift spans a reload.
//
// All functions here are pure: no Date.now(), no Math.random(), no storage,
// no React. `now` (and `dt` for accrueBonus) are always passed in by the
// caller so this file stays trivially replayable and testable.

import type { Config } from './config';
import type { Shift } from './types';

export type ShiftProgress = {
  /** Baseline work-time: real wall-clock ms since startedAt, capped. */
  wallMs: number;
  /** Bonus work-time bought by spacing out (capped mirror of shift.bonusMs). */
  bonusMs: number;
  /** wallMs + bonusMs, never exceeding shift.workRequiredMs. */
  workMs: number;
  /** workRequiredMs - workMs, never below 0. */
  remainingMs: number;
  /** workMs / workRequiredMs, clamped to [0, 1]. */
  fraction: number;
  /** True once workMs has reached workRequiredMs. */
  complete: boolean;
};

/**
 * Splits a shift's current work-time into its capped baseline and bonus
 * portions. This is the single place the capping rule from data-model.md
 * lives:
 *
 *   wallMs = min(now - startedAt, workRequiredMs - bonusMs), clamped >= 0
 *
 * Capping the baseline against `workRequiredMs - bonusMs` (rather than
 * capping the sum afterward) is what keeps `bonusMs` usable as-is in the
 * drain formula (shiftDrain) without a separate clamp there.
 */
function splitWorkTime(
  shift: Shift,
  now: number,
): { wallMs: number; bonusMs: number } {
  const bonusMs = Math.min(Math.max(0, shift.bonusMs), shift.workRequiredMs);
  const rawWallMs = Math.max(0, now - shift.startedAt);
  const wallCapMs = Math.max(0, shift.workRequiredMs - bonusMs);
  const wallMs = Math.min(rawWallMs, wallCapMs);
  return { wallMs, bonusMs };
}

/** Given (shift, now), what is the shift's work-time progress right now? */
export function shiftProgress(
  shift: Shift,
  now: number,
  _config: Config,
): ShiftProgress {
  const { wallMs, bonusMs } = splitWorkTime(shift, now);
  const workMs = wallMs + bonusMs;
  const remainingMs = Math.max(0, shift.workRequiredMs - workMs);
  const fraction =
    shift.workRequiredMs > 0
      ? Math.min(1, Math.max(0, workMs / shift.workRequiredMs))
      : 1;
  const complete = workMs >= shift.workRequiredMs;

  return { wallMs, bonusMs, workMs, remainingMs, fraction, complete };
}

/**
 * Total hours drained by this shift as of `now`, using the two-rate split
 * (research D6b):
 *
 *   drained = drainPerWorkMs * wallMs
 *           + SPACE_DRAIN_MULT * drainPerWorkMs * bonusMs
 *
 * Both `wallMs` and `bonusMs` here come from `splitWorkTime`, so drain stops
 * growing the instant the shift's work-time is exhausted — a shift that
 * finished 10 minutes ago while the tab was closed drains exactly one
 * shift's worth, never more.
 */
export function shiftDrain(shift: Shift, now: number, config: Config): number {
  const { wallMs, bonusMs } = splitWorkTime(shift, now);
  return (
    shift.drainPerWorkMs * wallMs +
    config.SPACE_DRAIN_MULT * shift.drainPerWorkMs * bonusMs
  );
}

/**
 * The new `bonusMs` value after `dt` ms elapsed while spacing out.
 *
 * While held, work-time advances at `SPACE_TIME_MULT` (3x): each real ms
 * contributes 1ms to the baseline (always, via wall-clock) plus
 * (SPACE_TIME_MULT - 1) = 2ms of bonus. When not spacing out, bonusMs is
 * unchanged — bonus never accrues from time spent away (FR-056 is true by
 * construction here, not by enforcement elsewhere).
 *
 * Capped at `workRequiredMs` so bonusMs alone can never imply more work-time
 * than a shift requires, which keeps it safe to use directly (uncapped) in
 * `shiftDrain`.
 */
export function accrueBonus(shift: Shift, dt: number, config: Config): number {
  if (!shift.spacingOut) return shift.bonusMs;

  const clampedDt = Math.max(0, dt);
  const bonusRatePerMs = config.SPACE_TIME_MULT - 1;
  const next = shift.bonusMs + bonusRatePerMs * clampedDt;
  return Math.min(next, shift.workRequiredMs);
}

/**
 * The instantaneous drain rate (hours per real ms) right now, for live
 * display (FR-054): the resting rate while at rest, or the accelerated
 * combined rate while spacing out.
 *
 * Derivation: per 1ms of real time while spacing out, wallMs advances by
 * 1ms (always) and bonusMs advances by (SPACE_TIME_MULT - 1)ms, so:
 *
 *   rate = drainPerWorkMs * (1 + (SPACE_TIME_MULT - 1) * SPACE_DRAIN_MULT)
 */
export function currentDrainRatePerMs(shift: Shift, config: Config): number {
  if (!shift.spacingOut) return shift.drainPerWorkMs;

  const bonusRatePerMs = config.SPACE_TIME_MULT - 1;
  return shift.drainPerWorkMs * (1 + bonusRatePerMs * config.SPACE_DRAIN_MULT);
}

export type DeathDuringShift = {
  died: boolean;
  /** Real ms elapsed since shift.startedAt at which death occurred, or null. */
  diedAtMs: number | null;
};

/**
 * Determines whether `shift.balanceAtStart` was exhausted by drain before
 * the shift completed (or before `now`, if the shift is still ongoing) —
 * computable purely from stored values so a player who closed the tab and
 * died at work is resolved correctly on return (research D6).
 *
 * The total drain accrued over the shift's active span (`drainAtEnd`, using
 * the same capped wallMs/bonusMs split as `shiftDrain`) is known exactly.
 * To find WHEN within that span the cumulative drain first reached
 * `balanceAtStart`, this treats both portions as having accrued at a
 * constant, uniform rate across the elapsed baseline span `T` (the capped
 * wallMs) — i.e. `bonusMs(t) = bonusMs * (t / T)` and `wallMs(t) = t`. Drain
 * is then linear in `t`:
 *
 *   drain(t) = (t / T) * drainAtEnd
 *
 * so the crossing point is `t* = (balanceAtStart / drainAtEnd) * T`. This is
 * exact whenever the spacing-out composition was constant throughout the
 * shift (entirely resting, or entirely spaced out) — the two cases that
 * matter for the death-during-away scenario, since spacing out cannot
 * happen while the tab is closed. If the player was spacing out, drainAtEnd
 * accrues faster per real ms, so `t*` — and therefore the death — lands
 * earlier in real time than the resting-only math would suggest.
 */
export function deathDuringShift(
  shift: Shift,
  now: number,
  config: Config,
): DeathDuringShift {
  const { wallMs: T } = splitWorkTime(shift, now);
  const drainAtEnd = shiftDrain(shift, now, config);

  if (T <= 0 || drainAtEnd <= 0) {
    return { died: false, diedAtMs: null };
  }

  if (drainAtEnd < shift.balanceAtStart) {
    return { died: false, diedAtMs: null };
  }

  const diedAtMs = (shift.balanceAtStart / drainAtEnd) * T;
  return { died: true, diedAtMs: Math.min(diedAtMs, T) };
}
