// Shared types for Game Buy Simulator.
// See specs/001-game-buy-simulator/data-model.md and contracts/ui-contract.md.

// ---------------------------------------------------------------------------
// Static catalogue data (src/data/catalogue.ts, never mutated)
// ---------------------------------------------------------------------------

export type Game = {
  id: string;
  title: string;
  blurb: string;
  /** Hours. Reference price; each listing may differ. */
  basePrice: number;
  /** true = held back for mid-run release (FR-045), absent from the starting catalogue. */
  releasePool?: boolean;
};

export type Storefront = {
  id: string;
  name: string;
  tagline: string;
  theme: {
    bg: string;
    fg: string;
    accent: string;
  };
};

export type Listing = {
  /** `${storefrontId}:${gameId}` — composite key used by sale discount maps. */
  id: string;
  storefrontId: string;
  gameId: string;
  /** This store's price for this game. */
  price: number;
};

// ---------------------------------------------------------------------------
// Puzzle
// ---------------------------------------------------------------------------

export type PuzzleKind = 'arithmetic' | 'match-shape' | 'type-word';

export type Puzzle = {
  kind: PuzzleKind;
  prompt: string;
  /** Compared case-insensitively, trimmed. */
  answer: string;
  /** Present for choice-based kinds. */
  choices?: string[];
};

// ---------------------------------------------------------------------------
// Shift
// ---------------------------------------------------------------------------

export type Shift = {
  /** Epoch ms. Source of truth for the baseline portion of progress. */
  startedAt: number;
  /** 45_000 — the work-time a shift takes at rest (FR-017). */
  workRequiredMs: number;
  /** Accumulated extra work-time bought by spacing out. */
  bonusMs: number;
  /** True while the hold-to-space-out control is held. Persisted as false. */
  spacingOut: boolean;
  /** Resting drain rate per ms of work-time. */
  drainPerWorkMs: number;
  /** Paid once, only on completion (FR-018). */
  wage: number;
  /** Must be solved to begin (FR-015). */
  puzzle: Puzzle;
  /** Recorded but has no effect on duration (FR-017). */
  puzzleSolvedAt: number | null;
  /** Enables replaying death-while-away without tick history. */
  balanceAtStart: number;
};

// ---------------------------------------------------------------------------
// Sale
// ---------------------------------------------------------------------------

export type Sale = {
  id: string;
  name: string;
  startedAt: number;
  endsAt: number;
  /** listingId -> percent off. A listing appears at most once (no stacking). */
  discounts: Record<string, number>;
};

// ---------------------------------------------------------------------------
// PurchaseRecord
// ---------------------------------------------------------------------------

export type PurchaseRecord = {
  gameId: string;
  storefrontId: string;
  /** Price before discount. */
  listPrice: number;
  /** What was actually deducted (FR-011). */
  pricePaid: number;
  /** 0 when bought at full price. */
  discountPercent: number;
  purchasedAt: number;
};

// ---------------------------------------------------------------------------
// Announcement (transient, not persisted)
// ---------------------------------------------------------------------------

export type Announcement = {
  id: string;
  kind: 'sale' | 'release';
  text: string;
  /** Auto-dismiss; also manually dismissible (FR-024). */
  expiresAt: number;
};

// ---------------------------------------------------------------------------
// RunState
// ---------------------------------------------------------------------------

export type RunStatus = 'playing' | 'dead' | 'won';

export type RunState = {
  /** Mismatch on load => discard save, fresh run. */
  schemaVersion: number;
  status: RunStatus;
  /** Float — drains continuously during shifts. Never below 0. */
  hoursRemaining: number;
  /** Epoch ms. Used for run-length stats. */
  startedAt: number;
  ownedGameIds: string[];
  /** Chronological, append-only. */
  history: PurchaseRecord[];
  /** Completed shifts only. */
  shiftsWorked: number;
  /** Cumulative hours lost to shifts. */
  hoursDrained: number;
  /** Cumulative wages. */
  hoursEarned: number;
  /** Release-pool games that have entered the catalogue. */
  releasedGameIds: string[];
  /** At most one active shift (FR-019). */
  activeShift: Shift | null;
  /** At most one active sale; no stacking (FR-028). */
  activeSale: Sale | null;
  /** Epoch ms of the next sale roll. */
  nextSaleAt: number;
  /** Epoch ms of the next release roll. */
  nextReleaseAt: number;
  /** Set when status leaves 'playing'. */
  endedAt: number | null;
  /**
   * UI-only convenience fields. Announcements are NOT persisted — storage
   * strips them on save/load; defined here only for the in-memory shape.
   */
  activeStorefrontId: string;
  announcements: Announcement[];
};

// ---------------------------------------------------------------------------
// Reducer action union (contracts/ui-contract.md)
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: 'BUY'; listingId: string; now: number }
  | { type: 'START_SHIFT'; puzzle: Puzzle; now: number }
  | { type: 'SOLVE_PUZZLE'; answer: string; now: number }
  | { type: 'SET_SPACING_OUT'; spacingOut: boolean; now: number }
  | { type: 'TICK'; now: number; dt: number; rand: () => number }
  | { type: 'DISMISS_ANNOUNCEMENT'; id: string }
  | { type: 'SET_STOREFRONT'; storefrontId: string }
  | { type: 'RESTART'; now: number };
