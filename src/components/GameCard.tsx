import { useEffect, useState } from 'react';
import type { Game, Listing } from '../lib/types';
import { Thumbnail } from './Thumbnail';
import { hours } from '../lib/format';

export function GameCard(props: {
  game: Game;
  listing: Listing;
  price: number;
  listPrice: number;
  discountPercent: number;
  owned: boolean;
  affordable: boolean;
  onBuy: () => void;
}) {
  const { game, price, listPrice, discountPercent, owned, affordable, onBuy } = props;

  const [justBought, setJustBought] = useState(false);

  useEffect(() => {
    if (!justBought) return;
    const timeoutId = setTimeout(() => setJustBought(false), 1000);
    return () => clearTimeout(timeoutId);
  }, [justBought]);

  const onSale = discountPercent > 0;

  function handleBuy() {
    onBuy();
    setJustBought(true);
  }

  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 shadow-md transition-transform duration-150 hover:-translate-y-0.5 hover:border-neutral-700 hover:shadow-lg">
      {onSale && (
        <span className="absolute left-2 top-2 z-10 rounded bg-rose-600 px-1.5 py-0.5 text-xs font-bold text-white">
          -{discountPercent}%
        </span>
      )}

      <div className="flex items-center justify-center bg-neutral-950 p-3">
        <Thumbnail gameId={game.id} size={112} />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="truncate text-sm font-semibold text-neutral-100">{game.title}</h3>

        <p className="line-clamp-2 text-xs text-neutral-400">{game.blurb}</p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex flex-col leading-tight">
            {onSale ? (
              <>
                <span className="text-xs text-neutral-500 line-through">{hours(listPrice, 0)}</span>
                <span className="text-base font-bold text-rose-400">{hours(price, 0)}</span>
              </>
            ) : (
              <span className="text-base font-bold text-neutral-100">{hours(price, 0)}</span>
            )}
          </div>

          {owned ? (
            <span
              aria-label={`${game.title}, owned`}
              className="rounded border border-emerald-800 bg-emerald-950 px-3 py-1.5 text-xs font-semibold text-emerald-400"
            >
              Owned
            </span>
          ) : (
            <button
              type="button"
              disabled={!affordable}
              onClick={handleBuy}
              aria-label={
                affordable ? `Buy ${game.title}` : `Buy ${game.title}, can't afford`
              }
              className="rounded bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
            >
              {justBought ? 'Bought.' : affordable ? 'Buy' : "Can't afford"}
            </button>
          )}
        </div>
      </div>

      {justBought && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-950/70 text-sm font-bold uppercase tracking-wide text-emerald-400"
        >
          Bought.
        </div>
      )}
    </div>
  );
}
