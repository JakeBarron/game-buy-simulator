/**
 * Deterministic, license-free "box art" generator for fictional games.
 * Zero image assets, zero network requests — everything is derived from a
 * pure string hash of the game id, so the same id always renders the same
 * artwork.
 */

// ---- deterministic hashing -------------------------------------------------

/** FNV-1a 32-bit hash. Pure, stable, no Math.random / Date. Returns a
 * non-negative integer in [0, 2^32). */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Derives an independent-ish deterministic value from `id` for a given
 * purpose, so several values can be pulled from one id without correlating. */
function seeded(id: string, salt: string): number {
  return fnv1a(`${id}::${salt}`);
}

// ---- spec -------------------------------------------------------------

export type MotifKind = 'circles' | 'bars' | 'triangles' | 'grid' | 'rings' | 'diagonal';

export interface ThumbnailSpec {
  gradientFrom: string;
  gradientTo: string;
  accent: string;
  motif: MotifKind;
  glyph: string;
  rotation: number;
}

const MOTIFS: MotifKind[] = ['circles', 'bars', 'triangles', 'grid', 'rings', 'diagonal'];

// Geometric / symbolic glyphs only — avoids emoji, which render
// inconsistently across platforms.
const GLYPHS = [
  '◆', '●', '▲', '■', '★', '⬢', '◈', '▣', '⬟', '⌘',
  '⚔', '⚙', '☰', '◐', '✦', '♦', '▼', '⬣', '❖', '⌬',
];

export function thumbnailSpec(id: string): ThumbnailSpec {
  const hueFrom = seeded(id, 'hueFrom') % 360;
  // Push the second hue 60-240deg away so gradients are always vivid,
  // never a near-flat wash of a single hue.
  const hueTo = (hueFrom + 60 + (seeded(id, 'hueTo') % 180)) % 360;

  const satFrom = 55 + (seeded(id, 'satFrom') % 20); // 55-74%
  const lightFrom = 38 + (seeded(id, 'lightFrom') % 12); // 38-49%
  const satTo = 55 + (seeded(id, 'satTo') % 20); // 55-74%
  const lightTo = 22 + (seeded(id, 'lightTo') % 12); // 22-33%, keeps the gradient dark enough for the glyph to read

  // Roughly complementary to hueFrom, bright and saturated, for a punchy
  // motif/accent that never washes out to grey.
  const accentHue = (hueFrom + 150 + (seeded(id, 'accentHue') % 60)) % 360;
  const accentSat = 70 + (seeded(id, 'accentSat') % 25); // 70-94%
  const accentLight = 55 + (seeded(id, 'accentLight') % 20); // 55-74%

  return {
    gradientFrom: `hsl(${hueFrom} ${satFrom}% ${lightFrom}%)`,
    gradientTo: `hsl(${hueTo} ${satTo}% ${lightTo}%)`,
    accent: `hsl(${accentHue} ${accentSat}% ${accentLight}%)`,
    motif: MOTIFS[seeded(id, 'motif') % MOTIFS.length],
    glyph: GLYPHS[seeded(id, 'glyph') % GLYPHS.length],
    rotation: seeded(id, 'rotation') % 360,
  };
}

// ---- svg rendering ------------------------------------------------------

function buildMotif(motif: MotifKind, size: number, accent: string): string {
  const shapes: string[] = [];
  const step = size / 6;
  switch (motif) {
    case 'circles':
      for (let y = step / 2; y < size; y += step) {
        for (let x = step / 2; x < size; x += step) {
          shapes.push(`<circle cx="${x}" cy="${y}" r="${step * 0.28}" fill="${accent}" />`);
        }
      }
      break;
    case 'bars':
      for (let x = 0; x < size; x += step) {
        shapes.push(`<rect x="${x}" y="0" width="${step * 0.45}" height="${size}" fill="${accent}" />`);
      }
      break;
    case 'triangles':
      for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
          const p = `${x},${y + step} ${x + step / 2},${y} ${x + step},${y + step}`;
          shapes.push(`<polygon points="${p}" fill="${accent}" />`);
        }
      }
      break;
    case 'grid':
      for (let x = 0; x <= size; x += step) {
        shapes.push(`<line x1="${x}" y1="0" x2="${x}" y2="${size}" stroke="${accent}" stroke-width="${step * 0.08}" />`);
      }
      for (let y = 0; y <= size; y += step) {
        shapes.push(`<line x1="0" y1="${y}" x2="${size}" y2="${y}" stroke="${accent}" stroke-width="${step * 0.08}" />`);
      }
      break;
    case 'rings':
      for (let r = step * 0.6; r < size; r += step) {
        shapes.push(`<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${accent}" stroke-width="${step * 0.18}" />`);
      }
      break;
    case 'diagonal':
      for (let offset = -size; offset < size * 2; offset += step) {
        shapes.push(`<line x1="${offset}" y1="0" x2="${offset + size}" y2="${size}" stroke="${accent}" stroke-width="${step * 0.22}" />`);
      }
      break;
  }
  return shapes.join('');
}

export function thumbnailSvg(id: string, size = 256): string {
  const spec = thumbnailSpec(id);
  // Gradient/clip ids must be unique per game so multiple thumbnails on one
  // page never share (and silently clobber) each other's <linearGradient>.
  // Combining a sanitized id fragment with its own hash makes collisions
  // between different ids astronomically unlikely, while the same id always
  // reproduces the exact same id string.
  const safeId = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'game';
  const gradId = `thumb-grad-${safeId}-${fnv1a(id).toString(36)}`;
  const cx = size / 2;
  const cy = size / 2;

  const motif = buildMotif(spec.motif, size, spec.accent);
  const fontSize = size * 0.42;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${safeId} cover art">
  <defs>
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${spec.gradientFrom}" />
      <stop offset="100%" stop-color="${spec.gradientTo}" />
    </linearGradient>
    <clipPath id="${gradId}-clip"><rect x="0" y="0" width="${size}" height="${size}" /></clipPath>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" fill="url(#${gradId})" />
  <g clip-path="url(#${gradId}-clip)" opacity="0.24" transform="rotate(${spec.rotation} ${cx} ${cy})">
    ${motif}
  </g>
  <text x="${cx}" y="${cy}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central"
    fill="#ffffff" fill-opacity="0.95" font-family="'Segoe UI Symbol', 'Noto Sans Symbols', sans-serif"
    style="paint-order: stroke; stroke: rgba(0,0,0,0.35); stroke-width: ${size * 0.01}px;">${spec.glyph}</text>
</svg>`;
}
