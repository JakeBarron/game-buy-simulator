import { useEffect, useRef } from 'react';
import { hoursWhole } from '../lib/format';
export function EndScreen(props: {
  status: 'dead' | 'won';
  gamesOwned: number;
  hoursSpent: number;
  shiftsWorked: number;
  hoursDrained: number;
  onRestart: () => void;
}) {
  const isDead = props.status === 'dead';
  const restartButtonRef = useRef<HTMLButtonElement>(null);

  // Move focus into the overlay as soon as it opens, so keyboard users land
  // somewhere sensible instead of wherever focus happened to be when the
  // background (now inert) went away.
  useEffect(() => {
    restartButtonRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center z-50">
      <div className="text-center max-w-2xl px-6">
        {/* Heading */}
        <h1 className="text-5xl font-black text-slate-100 mb-8 tracking-tight">
          {isDead ? 'Your time is up.' : 'You own everything.'}
        </h1>

        {/* Subheading / punchline */}
        <p className="text-lg text-slate-400 mb-12 leading-relaxed">
          {isDead ? (
            <>
              You owned <span className="text-amber-400 font-semibold">{props.gamesOwned}</span>{' '}
              games.
              <br />
              You played none of them.
            </>
          ) : (
            <>
              There is nothing left to buy.
              <br />
              New releases were coming anyway.
            </>
          )}
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-6 mb-12">
          <div className="bg-slate-900/50 rounded-lg px-6 py-8 border border-slate-800">
            <div className="text-4xl font-bold text-slate-100 mb-2">
              {props.gamesOwned}
            </div>
            <div className="text-sm text-slate-500 uppercase tracking-wide">
              Games Owned
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg px-6 py-8 border border-slate-800">
            <div className="text-4xl font-bold text-slate-100 mb-2">
              {hoursWhole(props.hoursSpent)}
            </div>
            <div className="text-sm text-slate-500 uppercase tracking-wide">
              Hours Spent
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg px-6 py-8 border border-slate-800">
            <div className="text-4xl font-bold text-slate-100 mb-2">
              {props.shiftsWorked}
            </div>
            <div className="text-sm text-slate-500 uppercase tracking-wide">
              Shifts Worked
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg px-6 py-8 border border-slate-800">
            <div className="text-4xl font-bold text-slate-100 mb-2">
              {hoursWhole(props.hoursDrained)}
            </div>
            <div className="text-sm text-slate-500 uppercase tracking-wide">
              Hours Drained
            </div>
          </div>
        </div>

        {/* Restart Button */}
        <button
          ref={restartButtonRef}
          onClick={props.onRestart}
          className={`
            px-8 py-4 rounded-lg font-semibold text-lg
            transition-all duration-200
            ${
              isDead
                ? 'bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-100'
                : 'bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-100'
            }
          `}
        >
          Start another life
        </button>
      </div>
    </div>
  );
}
