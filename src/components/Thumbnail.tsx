import { thumbnailSvg } from '../lib/thumbnail';

export function Thumbnail({
  gameId,
  size = 128,
  className,
}: {
  gameId: string;
  size?: number;
  className?: string;
}) {
  const svg = thumbnailSvg(gameId, size);

  return (
    <div
      className={`overflow-hidden rounded-md ${className || ''}`}
      style={{
        width: size,
        height: size,
      }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
