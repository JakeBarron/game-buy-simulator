import type { Puzzle } from '../lib/types';
import { PuzzleGate } from './Puzzle';
import { SpaceOutButton } from './SpaceOutButton';

export function WorkView(props: {
  puzzle: Puzzle | null;
  puzzleSolved: boolean;
  shiftActive: boolean;
  remainingMs: number;
  fraction: number;
  spacingOut: boolean;
  drainPerSecond: number;
  hoursRemaining: number;
  restingCost: number;
  spacedCost: number;
  onStartShift: () => void;
  onSolvePuzzle: (answer: string) => void;
  onSetSpacingOut: (v: boolean) => void;
}) {
  const {
    puzzle,
    puzzleSolved,
    shiftActive,
    remainingMs,
    fraction,
    spacingOut,
    drainPerSecond,
    hoursRemaining,
    restingCost,
    spacedCost,
    onStartShift,
    onSolvePuzzle,
    onSetSpacingOut,
  } = props;

  // State 1: no shift active.
  if (!shiftActive) {
    const lethal = hoursRemaining <= restingCost;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-100 p-8">
        <div className="w-full max-w-md text-center">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-6">
            The Job
          </p>

          <div className="bg-slate-800 border border-slate-700 p-8 mb-8 space-y-4 text-left">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Full shift, resting</span>
              <span className="font-mono text-slate-100">
                -{restingCost.toFixed(1)}h
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">
                Full shift, spaced out the whole way
              </span>
              <span className="font-mono text-fuchsia-400">
                -{spacedCost.toFixed(1)}h
              </span>
            </div>
            <div className="h-px bg-slate-700" />
            <p className="text-xs text-slate-500">
              Wage is only paid on completion. Quitting early pays nothing but
              you still keep whatever hours you already burned.
            </p>
          </div>

          {lethal && (
            <div className="mb-6 border border-red-500 bg-red-950/60 text-red-300 text-sm p-4">
              You have {hoursRemaining.toFixed(1)}h left. A full resting shift
              costs {restingCost.toFixed(1)}h. This shift will kill you.
            </div>
          )}

          <button
            onClick={onStartShift}
            className={[
              'w-full px-6 py-4 font-medium border transition-colors duration-150',
              lethal
                ? 'bg-red-800 hover:bg-red-700 border-red-500 text-red-50'
                : 'bg-slate-700 hover:bg-slate-600 border-slate-500 text-slate-100',
            ].join(' ')}
          >
            Clock in
          </button>
        </div>
      </div>
    );
  }

  const seconds = (remainingMs / 1000).toFixed(1);
  const progressPercent = Math.min(100, Math.max(0, fraction * 100));

  // State 2: shift active, puzzle unsolved. The countdown is already running.
  if (!puzzleSolved) {
    return (
      <div className="relative">
        <div className="bg-slate-950 border-b border-slate-800 px-8 py-3 flex items-center justify-between text-slate-400 text-sm">
          <span className="uppercase tracking-widest text-xs text-slate-500">
            Shift in progress
          </span>
          <span className="font-mono text-slate-200">{seconds}s remaining</span>
        </div>
        {puzzle ? (
          <PuzzleGate puzzle={puzzle} onSolved={onSolvePuzzle} />
        ) : null}
      </div>
    );
  }

  // State 3: shift active, puzzle solved — the main work screen.
  return (
    <div
      className={[
        'flex flex-col items-center justify-center min-h-screen p-8 transition-colors duration-300',
        spacingOut
          ? 'bg-fuchsia-950 text-fuchsia-100'
          : 'bg-slate-900 text-slate-100',
      ].join(' ')}
    >
      <div className="w-full max-w-md text-center">
        <p
          className={[
            'text-xs uppercase tracking-widest mb-2',
            spacingOut ? 'text-fuchsia-400' : 'text-slate-500',
          ].join(' ')}
        >
          {spacingOut ? 'Nothing matters' : 'Working. Allegedly.'}
        </p>

        <p
          className={[
            'text-6xl font-mono tabular-nums mb-6',
            spacingOut ? 'text-fuchsia-200' : 'text-slate-100',
          ].join(' ')}
        >
          {seconds}s
        </p>

        <div
          className={[
            'h-3 w-full mb-6 border overflow-hidden',
            spacingOut ? 'border-fuchsia-700 bg-fuchsia-900' : 'border-slate-700 bg-slate-800',
          ].join(' ')}
        >
          <div
            className={[
              'h-full transition-[width] duration-100',
              spacingOut ? 'bg-fuchsia-500' : 'bg-slate-400',
            ].join(' ')}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between mb-8 text-sm">
          <span className={spacingOut ? 'text-fuchsia-300' : 'text-slate-400'}>
            Drain rate
          </span>
          <span
            className={[
              'font-mono',
              spacingOut ? 'text-fuchsia-200' : 'text-slate-200',
            ].join(' ')}
          >
            -{drainPerSecond.toFixed(2)}h/s
          </span>
        </div>

        <p
          className={[
            'text-xs mb-8',
            spacingOut ? 'text-fuchsia-400' : 'text-slate-500',
          ].join(' ')}
        >
          {spacingOut
            ? 'The wall stares back. Time is basically a courtesy at this point.'
            : 'The fluorescent lights hum the same note they hummed yesterday. There is a spreadsheet somewhere that this is for.'}
        </p>

        <div className="flex justify-center">
          <SpaceOutButton spacingOut={spacingOut} onChange={onSetSpacingOut} />
        </div>
      </div>
    </div>
  );
}
