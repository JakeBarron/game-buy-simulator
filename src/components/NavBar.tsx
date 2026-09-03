export type View = 'store' | 'work' | 'library' | 'history';

export function NavBar(props: {
  view: View;
  onChange: (view: View) => void;
  onRestart: () => void;
  shiftActive: boolean;
  status: 'playing' | 'dead' | 'pricedOut';
}) {
  const views: Array<{ id: View; label: string }> = [
    { id: 'store', label: 'Store' },
    { id: 'work', label: 'Work' },
    { id: 'library', label: 'Library' },
    { id: 'history', label: 'History' },
  ];

  return (
    <nav className="w-full bg-slate-900 border-t border-slate-800 px-3 py-3 sm:px-6">
      {/* flex-wrap is the overflow guarantee at narrow viewports (Give Up drops
          to its own row rather than pushing the page wider); the trimmed
          padding/gap below just keeps everything on one row sooner. */}
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        {/* Main Navigation Buttons */}
        <div className="flex flex-wrap gap-1 sm:gap-2">
          {views.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => props.onChange(id)}
              className={`relative px-2.5 py-2 font-medium transition-colors rounded sm:px-4 ${
                props.view === id
                  ? 'bg-slate-700 text-slate-50'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
              aria-label={`View ${label}`}
              aria-pressed={props.view === id}
            >
              {label}
              {id === 'work' && props.shiftActive && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Give Up Button — only reachable mid-run; once the run has ended,
            RESTART is offered exclusively via the EndScreen's own button. */}
        {props.status === 'playing' && (
          <button
            onClick={props.onRestart}
            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-400 transition-colors rounded border border-slate-700 hover:border-slate-600 hover:bg-slate-800/30"
            aria-label="Give up and restart"
            title="Abandon this run"
          >
            Give up
          </button>
        )}
      </div>
    </nav>
  );
}
