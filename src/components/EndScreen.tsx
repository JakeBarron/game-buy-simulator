import { useEffect, useRef } from 'react';
import { hoursWhole } from '../lib/format';

/** One line of the score breakdown, plus which fully-owned series produced it (franchise line
 *  only). */
export type ScoreBreakdownVM = {
  collection: number;
  earlyAdopter: number;
  franchise: number;
  total: number;
  franchiseBonuses: { series: string; size: number; bonus: number }[];
};

/** A game the player did NOT own when it was re-appraised up (regret list), or the single owned
 *  game re-appraised down the worst (worst hold) — same shape either way, joined against the
 *  catalogue by App.tsx so this component never needs to look games up itself. */
export type RegretItemVM = {
  gameId: string;
  title: string;
  basePrice: number;
  oldMarketRating: number;
  newMarketRating: number;
  oldTrueValue: number;
  newTrueValue: number;
};

/** `destiny-witness` -> `Destiny Witness`. Series ids are kebab-case data keys, not display
 *  copy. */
function formatSeriesName(series: string): string {
  return series
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function EndScreen(props: {
  status: 'dead' | 'pricedOut';
  /** True when the run ended because there was nothing left to buy at all,
   *  rather than because the player simply ran out of purchasing power —
   *  the end screen reads differently for the two cases. Meaningless when
   *  status is 'dead'. */
  catalogueExhausted: boolean;
  gamesOwned: number;
  hoursSpent: number;
  shiftsWorked: number;
  hoursDrained: number;
  scoreBreakdown: ScoreBreakdownVM;
  /** Games the player passed on that got re-appraised UP while they still didn't own them —
   *  the "one more run" list. Empty means nothing qualified this run, not that the section is
   *  omitted. */
  regretItems: RegretItemVM[];
  /** The single worst hold (an owned game re-appraised down), if the run produced one. */
  worstHold: RegretItemVM | null;
  onRestart: () => void;
}) {
  const isDead = props.status === 'dead';
  const restartButtonRef = useRef<HTMLButtonElement>(null);
  const { scoreBreakdown, regretItems } = props;

  // Move focus into the overlay as soon as it opens, so keyboard users land
  // somewhere sensible instead of wherever focus happened to be when the
  // background (now inert) went away.
  useEffect(() => {
    restartButtonRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="text-center w-full max-w-2xl">
          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl font-black text-slate-100 mb-6 sm:mb-8 tracking-tight">
            {isDead
              ? 'Your time is up.'
              : props.catalogueExhausted
                ? 'You own everything there is.'
                : 'You just got priced out.'}
          </h1>

          {/* Subheading / punchline */}
          <p className="text-lg text-slate-400 mb-10 leading-relaxed">
            {isDead ? (
              <>
                You owned <span className="text-amber-400 font-semibold">{props.gamesOwned}</span>{' '}
                games.
                <br />
                You played none of them.
              </>
            ) : props.catalogueExhausted ? (
              <>
                Every last listing, yours. Nothing left to buy — for once, the market
                <br />
                didn&apos;t beat you to it. It&apos;ll keep climbing anyway.
              </>
            ) : (
              <>
                You didn&apos;t die. You simply can&apos;t afford anything anymore.
                <br />
                The market moved on without you.
              </>
            )}
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-10">
            <div className="bg-slate-900/50 rounded-lg px-4 py-6 sm:px-6 sm:py-8 border border-slate-800">
              <div className="text-3xl sm:text-4xl font-bold text-slate-100 mb-2">
                {props.gamesOwned}
              </div>
              <div className="text-xs sm:text-sm text-slate-500 uppercase tracking-wide">
                Games Owned
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg px-4 py-6 sm:px-6 sm:py-8 border border-slate-800">
              <div className="text-3xl sm:text-4xl font-bold text-slate-100 mb-2">
                {hoursWhole(props.hoursSpent)}
              </div>
              <div className="text-xs sm:text-sm text-slate-500 uppercase tracking-wide">
                Hours Spent
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg px-4 py-6 sm:px-6 sm:py-8 border border-slate-800">
              <div className="text-3xl sm:text-4xl font-bold text-slate-100 mb-2">
                {props.shiftsWorked}
              </div>
              <div className="text-xs sm:text-sm text-slate-500 uppercase tracking-wide">
                Shifts Worked
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg px-4 py-6 sm:px-6 sm:py-8 border border-slate-800">
              <div className="text-3xl sm:text-4xl font-bold text-slate-100 mb-2">
                {hoursWhole(props.hoursDrained)}
              </div>
              <div className="text-xs sm:text-sm text-slate-500 uppercase tracking-wide">
                Hours Drained
              </div>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="mb-10 text-left mx-auto bg-slate-900/50 rounded-lg border border-slate-800 px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-4 text-center">
              Score Breakdown
            </h2>
            <dl className="space-y-2 text-sm sm:text-base">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Collection score</dt>
                <dd className="text-slate-200 font-medium tabular-nums">
                  {scoreBreakdown.collection} pts
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Early-adopter bonuses</dt>
                <dd className="text-slate-200 font-medium tabular-nums">
                  {scoreBreakdown.earlyAdopter} pts
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Franchise bonuses</dt>
                  <dd className="text-slate-200 font-medium tabular-nums">
                    {scoreBreakdown.franchise} pts
                  </dd>
                </div>
                {scoreBreakdown.franchiseBonuses.length > 0 && (
                  <div className="text-xs text-slate-500 pl-0">
                    {scoreBreakdown.franchiseBonuses
                      .map((f) => `${formatSeriesName(f.series)} (${f.size}/${f.size}): +${f.bonus}`)
                      .join(' · ')}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-800 pt-2 flex items-center justify-between gap-3">
                <dt className="text-slate-100 font-semibold">Total</dt>
                <dd className="text-amber-400 font-bold text-lg tabular-nums">
                  {scoreBreakdown.total} pts
                </dd>
              </div>
            </dl>
          </div>

          {/* Regret list — the replay engine. */}
          <div className="mb-10 text-left mx-auto">
            <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-3 text-center">
              What You Passed On
            </h2>
            {regretItems.length === 0 ? (
              <p className="text-slate-500 text-sm text-center bg-slate-900/30 rounded-lg border border-slate-800 px-5 py-4">
                Nothing you skipped got re-appraised up this run.
              </p>
            ) : (
              <ul className="space-y-3">
                {regretItems.map((item) => (
                  <li
                    key={item.gameId}
                    className="bg-slate-900/60 border border-amber-900/40 rounded-lg px-4 py-3 sm:px-5 sm:py-4"
                  >
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <span className="font-semibold text-slate-100">{item.title}</span>
                      <span className="text-amber-400 font-medium tabular-nums">
                        {hoursWhole(item.basePrice)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      Rated ★{item.oldMarketRating} when you skipped it, now ★{item.newMarketRating}.
                      {' '}Hidden value: {item.oldTrueValue} → {item.newTrueValue}.
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {props.worstHold && (
            <p className="text-xs text-slate-500 mb-10 -mt-4">
              Worst hold: {props.worstHold.title} slid to a true value of {props.worstHold.newTrueValue}{' '}
              while you owned it.
            </p>
          )}

          {/* Restart Button */}
          <button
            ref={restartButtonRef}
            onClick={props.onRestart}
            className="px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-100"
          >
            Start another life
          </button>
        </div>
      </div>
    </div>
  );
}
