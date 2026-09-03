import type { Announcement } from '../lib/types';

/**
 * Toast + dismiss-button styling per announcement. `reappraisal` gets four distinct looks along
 * two axes (Task 5, Part C) so a glance tells the player which case they're looking at:
 *   - owned cases are bold, saturated fills (it's your asset that just moved) — green for the
 *     triumphant up, red for the grim down.
 *   - unowned cases are muted, bordered outlines (informational, not about your money) — amber
 *     for the one that stings (it got better without you), emerald for the quiet relief of a
 *     dodge.
 * 'sale' and 'release' are unchanged from Task 2/4.
 */
function toastClasses(announcement: Announcement): { box: string; dismiss: string } {
  if (announcement.kind === 'sale') {
    return {
      box: 'bg-amber-400 text-amber-950 font-semibold animate-pulse',
      dismiss: 'hover:bg-amber-500 active:bg-amber-600 text-amber-950',
    };
  }
  if (announcement.kind === 'reappraisal' && announcement.reappraisal) {
    const { owned, direction } = announcement.reappraisal;
    if (owned && direction === 'up') {
      return {
        box: 'bg-emerald-500 text-emerald-950 font-bold',
        dismiss: 'hover:bg-emerald-600 active:bg-emerald-700 text-emerald-950',
      };
    }
    if (owned && direction === 'down') {
      return {
        box: 'bg-rose-600 text-rose-50 font-bold',
        dismiss: 'hover:bg-rose-700 active:bg-rose-800 text-rose-50',
      };
    }
    if (!owned && direction === 'up') {
      return {
        box: 'bg-neutral-900 text-orange-300 border border-orange-700',
        dismiss: 'hover:bg-neutral-800 active:bg-neutral-700 text-orange-300',
      };
    }
    return {
      box: 'bg-neutral-900 text-emerald-300 border border-emerald-700',
      dismiss: 'hover:bg-neutral-800 active:bg-neutral-700 text-emerald-300',
    };
  }
  return {
    box: 'bg-slate-700 text-slate-100',
    dismiss: 'hover:bg-slate-600 active:bg-slate-500 text-slate-100',
  };
}

export function AnnouncementStack(props: {
  announcements: Announcement[];
  onDismiss: (id: string) => void;
}) {
  if (props.announcements.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 max-w-[calc(100vw-3rem)] space-y-3">
      {props.announcements.map((announcement) => {
        const { box, dismiss } = toastClasses(announcement);
        return (
          <div
            key={announcement.id}
            className={`
              pointer-events-auto
              flex items-center gap-3 px-4 py-3 rounded-lg
              shadow-lg
              animate-in slide-in-from-bottom-2 duration-300
              ${box}
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
                ${dismiss}
              `}
              aria-label="Dismiss"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
