import type { Game } from '../lib/types';
import { Thumbnail } from './Thumbnail';

export function LibraryView(props: {
  games: Game[];
  totalHoursSpent: number;
}) {
  const { games, totalHoursSpent } = props;

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="border-b border-gray-700 pb-6">
        <h1 className="text-3xl font-bold text-gray-100">
          Your Library
          <span className="ml-2 text-lg font-normal text-gray-400">
            ({games.length} {games.length === 1 ? 'game' : 'games'})
          </span>
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Owned. Unplayed. Yours forever.
        </p>
        <p className="mt-3 text-gray-300">
          Time invested:{' '}
          <span className="font-semibold text-white">
            {totalHoursSpent.toFixed(1)} hours
          </span>
        </p>
      </div>

      {/* Content */}
      {games.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-center text-gray-400">
            You own nothing. Your time is still your own.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {games.map((game) => (
            <div key={game.id} className="flex flex-col gap-3">
              <Thumbnail gameId={game.id} size={128} />
              <h2 className="text-sm font-medium text-gray-200 leading-tight line-clamp-2">
                {game.title}
              </h2>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
