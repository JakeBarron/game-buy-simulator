export type View = 'store' | 'work' | 'library' | 'history';

export function NavBar(props: {
  view: View;
  onChange: (view: View) => void;
  onRestart: () => void;
  shiftActive: boolean;
}) {
  const views: Array<{ id: View; label: string }> = [
    { id: 'store', label: 'Store' },
    { id: 'work', label: 'Work' },
    { id: 'library', label: 'Library' },
    { id: 'history', label: 'History' },
  ];

  return (
    <nav className="w-full bg-slate-900 border-t border-slate-800 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Main Navigation Buttons */}
        <div className="flex gap-2">
          {views.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => props.onChange(id)}
              className={`relative px-4 py-2 font-medium transition-colors rounded ${
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

        {/* Give Up Button */}
        <button
          onClick={props.onRestart}
          className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-400 transition-colors rounded border border-slate-700 hover:border-slate-600 hover:bg-slate-800/30"
          aria-label="Give up and restart"
          title="Abandon this run"
        >
          Give up
        </button>
      </div>
    </nav>
  );
}
