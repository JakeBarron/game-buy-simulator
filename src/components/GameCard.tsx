import { useEffect, useState } from 'react';
import type { Game, Listing, Review, ReviewSentiment } from '../lib/types';
import { Thumbnail } from './Thumbnail';
import { Stars } from './Stars';
import { hours } from '../lib/format';

const SENTIMENT_LABEL: Record<ReviewSentiment, string> = {
  glowing: 'Glowing',
  positive: 'Positive',
  mixed: 'Mixed',
  negative: 'Negative',
  damning: 'Damning',
};

export function GameCard(props: {
  game: Game;
  listing: Listing;
  price: number;
  listPrice: number;
  discountPercent: number;
  owned: boolean;
  affordable: boolean;
  /** This run's per-run review selection (valuation.selectReviews) — NOT the raw pool, and
   *  NOT a hint at the hidden true value; true value itself is never shown here. */
  displayedReviews: Review[];
  onBuy: () => void;
}) {
  const { game, price, listPrice, discountPercent, owned, affordable, displayedReviews, onBuy } = props;

  const [justBought, setJustBought] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);

  useEffect(() => {
    if (!justBought) return;
    const timeoutId = setTimeout(() => setJustBought(false), 1000);
    return () => clearTimeout(timeoutId);
  }, [justBought]);

  const onSale = discountPercent > 0;
  const reviewsPanelId = `${game.id}-reviews`;

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

        <div
          className="flex items-center gap-1.5 text-xs"
          aria-label={`Rated ${game.marketRating} out of 5 stars, ${game.reviewCount.toLocaleString()} reviews`}
        >
          <Stars rating={game.marketRating} />
          <span className="text-neutral-500">({game.reviewCount.toLocaleString()})</span>
        </div>

        <button
          type="button"
          aria-expanded={reviewsOpen}
          aria-controls={reviewsPanelId}
          aria-label={`${reviewsOpen ? 'Hide' : 'Show'} reviews for ${game.title}`}
          onClick={() => setReviewsOpen((open) => !open)}
          className="-ml-3 -mt-1 self-start rounded px-3 py-1.5 text-xs font-medium text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
        >
          {reviewsOpen ? 'Hide reviews' : `Reviews (${displayedReviews.length})`}
        </button>

        <ul
          id={reviewsPanelId}
          hidden={!reviewsOpen}
          className="flex flex-col gap-2 rounded bg-neutral-950/60 p-2"
        >
          {displayedReviews.map((review, i) => (
            <li key={i} className="break-words text-xs leading-snug">
              <span className="font-semibold text-neutral-300">
                {SENTIMENT_LABEL[review.sentiment]}
              </span>
              <span className="text-neutral-500"> — {review.author}</span>
              <p className="text-neutral-400">{review.text}</p>
            </li>
          ))}
        </ul>

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
