import { useEffect, useRef } from 'react';

export function SpaceOutButton(props: {
  spacingOut: boolean;
  onChange: (spacingOut: boolean) => void;
  disabled?: boolean;
}) {
  const { spacingOut, onChange, disabled } = props;
  const keyHeldRef = useRef(false);

  // Never let unmounting (e.g. navigating away) leave the player stuck spaced out.
  useEffect(() => {
    return () => {
      onChange(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The browser window itself losing focus (alt-tab, devtools, etc.) must
  // also release the hold — a pointerup can never fire once focus is gone.
  useEffect(() => {
    const handleWindowBlur = () => {
      onChange(false);
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (disabled) return;
    onChange(true);
  };

  const stop = () => {
    onChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (keyHeldRef.current) return; // guard against auto-repeat
    keyHeldRef.current = true;
    start();
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    keyHeldRef.current = false;
    stop();
  };

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <button
        type="button"
        disabled={disabled}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onBlur={stop}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        className={[
          'px-8 py-4 font-bold uppercase tracking-widest border transition-colors duration-100 touch-none',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
          disabled
            ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
            : spacingOut
              ? 'bg-fuchsia-700 border-fuchsia-400 text-fuchsia-50 shadow-[0_0_20px_rgba(217,70,239,0.6)] animate-pulse cursor-pointer'
              : 'bg-slate-700 hover:bg-slate-600 border-slate-500 text-slate-100 cursor-pointer',
        ].join(' ')}
      >
        {spacingOut ? '...' : 'Stare at the wall'}
      </button>
      <p className="text-xs text-slate-500 text-center max-w-[16rem]">
        Makes the shift fly by. Burns hours 1.5x faster while held.
      </p>
    </div>
  );
}
