import { hours, hoursPerSecond } from '../lib/format';
export function HoursHeader(props: {
  hoursRemaining: number;
  shiftRemainingMs: number | null;
  spacingOut: boolean;
  drainPerSecond: number;
  owned: number;
  available: number;
  cannotAffordShift: boolean;
}) {
  const formatHours = (h: number) => hours(h);
  const formatSeconds = (ms: number) => (ms / 1000).toFixed(1);
  const progressPercent = props.available > 0 ? (props.owned / props.available) * 100 : 0;

  return (
    <header className="w-full bg-slate-950 border-b border-slate-800 px-6 py-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Hours Remaining - Main Display */}
        <div className="flex items-baseline gap-3">
          <div className="text-5xl font-bold font-mono tracking-tight">
            <span className="text-slate-100">{formatHours(props.hoursRemaining)}</span>
          </div>
          <span className="text-slate-400 text-sm">remaining</span>
        </div>

        {/* Shift Status & Collection Progress */}
        <div className="flex items-center justify-between gap-6">
          {/* Shift Indicator */}
          <div className="flex-shrink-0">
            {props.shiftRemainingMs !== null ? (
              <div
                className={`text-sm font-mono px-3 py-2 rounded border ${
                  props.spacingOut
                    ? 'bg-red-950 border-red-700 text-red-200'
                    : 'bg-blue-950 border-blue-700 text-blue-200'
                }`}
              >
                <div className="font-bold">
                  {props.spacingOut ? '⚡ spacing out' : 'at work'}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {formatSeconds(props.shiftRemainingMs)}s left • {hoursPerSecond(props.drainPerSecond)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">not working</div>
            )}
          </div>

          {/* Collection Progress */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300 font-mono">
                {props.owned} / {props.available} owned
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Cannot Afford Shift Warning */}
        {props.cannotAffordShift && (
          <div className="text-xs text-amber-200 bg-amber-950/30 border border-amber-900 rounded px-3 py-2">
            ⚠ Cannot survive a full shift. Spacing out costs even more.
          </div>
        )}
      </div>
    </header>
  );
}
