// Shared types for Game Buy Simulator.
// See specs/001-game-buy-simulator/data-model.md and contracts/ui-contract.md.

// ---------------------------------------------------------------------------
// Static catalogue data (src/data/catalogue.ts, never mutated)
// ---------------------------------------------------------------------------

/** Blurb archetype tags. The tell a player reads alongside rating/review count. */
export type GameTrait =
  | 'contemplative'
  | 'asset-flip'
  | 'annual-sequel'
  | 'early-access'
  | 'cult'
  | 'hype'
  | 'grind'
  | 'prestige';

export type ReviewSentiment = 'glowing' | 'positive' | 'mixed' | 'negative' | 'damning';

export type Review = {
  sentiment: ReviewSentiment;
  text: string;
  author: string;
};

export type Game = {
  id: string;
  title: string;
  blurb: string;
  /** Hours. Reference price; each listing may differ. */
  basePrice: number;
  /** true = held back for mid-run release (FR-045), absent from the starting catalogue. */
  releasePool?: boolean;
  /** 1-3 blurb archetype tags; must match what the blurb implies. */
  traits: GameTrait[];
  /** Crowd's average opinion, 1-5, integer. Visible; drives sale frequency later. */
  marketRating: number;
  /** How much to trust marketRating — a rating with few reviews is noise. */
  reviewCount: number;
  /**
   * POOL of 5-8 authored reviews spanning sentiments, not the reviews shown.
   * A run selects a stable slice for display (Task 3+ selects per-run).
   */
  reviews: Review[];
  /** Franchise id, only for games that belong to one implied sequel/series. */
  series?: string;
};

export type Storefront = {
  id: string;
  name: string;
  tagline: string;
  /** Parent company shown in the store header. */
  owner: string;
  theme: {
    bg: string;
    fg: string;
    accent: string;
  };
  /**
   * Scales the exponent of this store's inflation (inflation.ts
   * inflationMultiplier): 1.0 doubles prices exactly every
   * config.INFLATION_DOUBLING_MS; > 1 compounds faster, < 1 slower. The
   * strategic axis of the run — cream has the better catalogue but is
   * running away from you; flat shelf is mostly junk but stays affordable.
   */
  inflationRate: number;
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
  /** Cumulative drain already subtracted from the balance. Makes drain
   *  application independent of tick cadence, so a shift that advanced while
   *  the tab was closed still charges for that time on the next tick. */
  drainApplied: number;
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

export type RunStatus = 'playing' | 'dead' | 'pricedOut';

export type RunState = {
  /** Mismatch on load => discard save, fresh run. */
  schemaVersion: number;
  status: RunStatus;
  /** Float — drains continuously during shifts. Never below 0. */
  hoursRemaining: number;
  /** Epoch ms. Used for run-length stats. */
  startedAt: number;
  ownedGameIds: string[];
  /**
   * Every game's hidden true value (1-5), rolled once at run start and never rerolled. Never
   * shown for an unowned game — see valuation.ts.
   */
  trueValues: Record<string, number>;
  /**
   * Per-run selection of which reviews from each game's authored pool are on display, rolled
   * once at run start alongside `trueValues` so both stay stable across re-renders and reloads
   * — rerolling either would silently invalidate every bet the player has made.
   */
  displayedReviews: Record<string, Review[]>;
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
  /** False until the player dismisses the opening screen. Persisted so it
   *  does not reappear on reload, and reset by RESTART. */
  welcomeSeen: boolean;
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
  | { type: 'DISMISS_WELCOME' }
  | { type: 'RESTART'; now: number; rand: () => number };
