/** Decorative star rating (1-5). Purely visual — callers wrap it in an element that carries the
 *  actual accessible label, since the same visual shape is used for both the crowd's visible
 *  `marketRating` and (for owned games only) the hidden `trueValue`. */
export function Stars(props: { rating: number; className?: string }) {
  const { rating, className } = props;
  return (
    <span aria-hidden="true" className={`tracking-tight text-amber-400 ${className ?? ''}`}>
      {'★'.repeat(rating)}
      <span className="text-neutral-700">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}
