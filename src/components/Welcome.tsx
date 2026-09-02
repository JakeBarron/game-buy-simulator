import { CURRENCY, hours } from '../lib/format'

/**
 * Shown once at the start of a run. Explains the premise and the one rule
 * players otherwise have to learn by dying: working costs hours while it
 * earns them.
 */
export function Welcome(props: {
  startingHours: number
  restingCost: number
  spacedCost: number
  wage: number
  onDismiss: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6">
      <div className="max-w-xl w-full">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3">
          Welcome to Cream
        </p>
        <h1 className="text-4xl font-bold text-slate-100 mb-5 leading-tight">
          You have {hours(props.startingHours)} left to live.
        </h1>

        <div className="space-y-3 text-slate-300 leading-relaxed">
          <p>
            {CURRENCY} is measured in hours until you die. It is the only currency
            here, and games are priced in it. Buying one costs you that much life.
          </p>
          <p>
            You cannot play the games. You can only own them.
          </p>
          <p>
            When you run low, go to work. A shift takes 45 seconds and pays{' '}
            <span className="text-emerald-400 font-medium">{hours(props.wage)}</span>
            {' '}— but it drains{' '}
            <span className="text-rose-400 font-medium">{hours(props.restingCost)}</span>
            {' '}while you sit there, and the wage only arrives if you stay to the end.
          </p>
          <p>
            You can hold <span className="text-fuchsia-400 font-medium">Stare at the wall</span>{' '}
            to make a shift pass three times faster. It costs{' '}
            <span className="text-fuchsia-400 font-medium">{hours(props.spacedCost)}</span>{' '}
            instead. Time moves quicker when you stop paying attention. It always did.
          </p>
          <p className="text-slate-400 text-sm pt-1">
            Watch for sales. New games keep releasing. You will not catch up.
          </p>
        </div>

        <button
          onClick={props.onDismiss}
          className="mt-8 w-full rounded bg-slate-100 px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-white"
        >
          Begin spending
        </button>
      </div>
    </div>
  )
}
