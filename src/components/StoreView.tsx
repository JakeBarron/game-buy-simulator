import type { CSSProperties } from 'react';
import type { Game, Listing, Storefront } from '../lib/types';
import { GameCard } from './GameCard';

export type StoreListingVM = {
  game: Game;
  listing: Listing;
  price: number;
  listPrice: number;
  discountPercent: number;
  owned: boolean;
  affordable: boolean;
};

export function StoreView(props: {
  storefronts: Storefront[];
  activeStorefrontId: string;
  onSelectStorefront: (id: string) => void;
  listings: StoreListingVM[];
  onBuy: (listingId: string) => void;
}) {
  const { storefronts, activeStorefrontId, onSelectStorefront, listings, onBuy } = props;

  const activeStorefront =
    storefronts.find((store) => store.id === activeStorefrontId) ?? storefronts[0];

  const allOwned = listings.length > 0 && listings.every((listing) => listing.owned);
  const isEmpty = listings.length === 0 || allOwned;

  // Unowned before owned; within unowned, discounted first.
  const sortedListings = [...listings].sort((a, b) => {
    if (a.owned !== b.owned) return a.owned ? 1 : -1;
    if (!a.owned) {
      const aDiscounted = a.discountPercent > 0;
      const bDiscounted = b.discountPercent > 0;
      if (aDiscounted !== bDiscounted) return aDiscounted ? -1 : 1;
    }
    return 0;
  });

  const themeStyle: CSSProperties | undefined = activeStorefront
    ? ({
        '--store-bg': activeStorefront.theme.bg,
        '--store-fg': activeStorefront.theme.fg,
        '--store-accent': activeStorefront.theme.accent,
        backgroundColor: 'var(--store-bg)',
        color: 'var(--store-fg)',
      } as CSSProperties)
    : undefined;

  return (
    <div
      className="min-h-[60vh] rounded-xl border border-black/10 p-4 transition-colors duration-300 sm:p-6"
      style={themeStyle}
    >
      <div role="tablist" aria-label="Storefronts" className="mb-6 flex flex-wrap gap-2">
        {storefronts.map((store) => {
          const active = store.id === activeStorefrontId;
          return (
            <button
              key={store.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectStorefront(store.id)}
              className={
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ' +
                (active ? 'shadow-md' : 'bg-black/20 text-white/70 hover:bg-black/30')
              }
              style={
                active
                  ? { backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' }
                  : undefined
              }
            >
              {store.name}
            </button>
          );
        })}
      </div>

      {activeStorefront && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--store-accent)' }}>
            {activeStorefront.name}
          </h2>
          <p className="text-sm opacity-75">{activeStorefront.tagline}</p>
        </div>
      )}

      {isEmpty ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center"
          style={{ borderColor: 'var(--store-accent)' }}
        >
          <p className="text-lg font-semibold">
            {listings.length === 0 ? 'Nothing for sale here right now.' : 'You own everything here.'}
          </p>
          <p className="max-w-sm text-sm opacity-70">
            {listings.length === 0
              ? 'Check back later, or try a different store.'
              : 'There is nothing left to want.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {sortedListings.map((vm) => (
            <GameCard
              key={vm.listing.id}
              game={vm.game}
              listing={vm.listing}
              price={vm.price}
              listPrice={vm.listPrice}
              discountPercent={vm.discountPercent}
              owned={vm.owned}
              affordable={vm.affordable}
              onBuy={() => onBuy(vm.listing.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
