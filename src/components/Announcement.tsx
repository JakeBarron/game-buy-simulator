import type { Announcement } from '../lib/types';

export function AnnouncementStack(props: {
  announcements: Announcement[];
  onDismiss: (id: string) => void;
}) {
  if (props.announcements.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 space-y-3">
      {props.announcements.map((announcement) => (
        <div
          key={announcement.id}
          className={`
            pointer-events-auto
            flex items-center gap-3 px-4 py-3 rounded-lg
            shadow-lg
            animate-in slide-in-from-bottom-2 duration-300
            ${
              announcement.kind === 'sale'
                ? 'bg-amber-400 text-amber-950 font-semibold animate-pulse'
                : 'bg-slate-700 text-slate-100'
            }
          `}
        >
          <span className="flex-1 text-sm">
            {announcement.text}
          </span>
          <button
            onClick={() => props.onDismiss(announcement.id)}
            className={`
              flex-shrink-0 ml-2 inline-flex items-center justify-center
              w-5 h-5 rounded
              transition-colors duration-150
              ${
                announcement.kind === 'sale'
                  ? 'hover:bg-amber-500 active:bg-amber-600 text-amber-950'
                  : 'hover:bg-slate-600 active:bg-slate-500 text-slate-100'
              }
            `}
            aria-label="Dismiss"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
