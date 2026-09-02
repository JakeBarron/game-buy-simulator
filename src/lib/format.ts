// The currency symbol for hours-till-death.
//
// A struck letter, which is how most real currency symbols are built (¥, ₩, ₡,
// ₦ are all struck letters). It reads as money rather than as a unit of
// measurement, and unlike an emoji hourglass it renders consistently in every
// font and never picks up a colour of its own.
export const CURRENCY = 'Ħ'

/** Money-style amount, e.g. Ħ62.0 — prefixed like $, not suffixed like a unit. */
export function hours(n: number, decimals = 1): string {
  return `${CURRENCY}${n.toFixed(decimals)}`
}

/** Whole-number amount for stat blocks, e.g. Ħ1447. */
export function hoursWhole(n: number): string {
  return `${CURRENCY}${Math.floor(n)}`
}

/** A rate, e.g. Ħ1.0/s. */
export function hoursPerSecond(n: number, decimals = 1): string {
  return `${CURRENCY}${n.toFixed(decimals)}/s`
}
