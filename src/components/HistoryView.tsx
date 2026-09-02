import type { PurchaseRecord } from '../lib/types';
import { hours } from '../lib/format';

export function HistoryView(props: {
  records: { record: PurchaseRecord; gameTitle: string; storefrontName: string }[];
  totalHoursSpent: number;
}) {
  const { records, totalHoursSpent } = props;

  const formatTime = (epochMs: number): string => {
    return new Date(epochMs).toLocaleString();
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="border-b border-gray-700 pb-6">
        <h1 className="text-3xl font-bold text-gray-100">Purchase History</h1>
        <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400 uppercase tracking-wide">
            Total Hours Spent
          </p>
          <p className="mt-2 text-4xl font-bold text-white">
            {hours(totalHoursSpent)}
          </p>
        </div>
      </div>

      {/* Content */}
      {records.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-center text-gray-400">No purchases yet.</p>
        </div>
      ) : (
        <div>
          <ul className="divide-y divide-gray-700">
            {records.map((item) => {
              const { record, gameTitle, storefrontName } = item;
              const isOnSale = record.discountPercent > 0;

              return (
                <li key={record.purchasedAt} className="py-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-100">
                        {gameTitle}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {storefrontName}
                      </p>
                      {isOnSale && (
                        <div className="mt-2 inline-flex items-center gap-2 bg-green-900 bg-opacity-40 border border-green-700 rounded px-2 py-1">
                          <span className="text-xs font-semibold text-green-300">
                            {record.discountPercent}% OFF
                          </span>
                          <span className="text-xs text-green-200 line-through">
                            {hours(record.listPrice)}
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {formatTime(record.purchasedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-white">
                        {hours(record.pricePaid)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
