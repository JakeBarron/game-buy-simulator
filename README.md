# Game Buy Simulator

A browser game about speculating on video games with your remaining hours. Your currency is
"hours-till-death"—a dwindling resource. Every game on the shelf has a visible crowd rating and a
hidden true value that may not match it: a niche `cult` or `contemplative` title with few reviews
can be a sleeper worth far more than the crowd thinks, and a `hype` blockbuster or `annual-sequel`
can be a disappointment waiting to happen. Reviews, review counts, and traits are the tells; reading
them (or ignoring them) is the game.

Buy from three parody storefronts, each inflating its prices at its own rate — the flashier store's
catalogue is better but running away from you, the bargain bin stays cheap. Prices climb the whole
run, sales knock them down temporarily, and the crowd itself periodically changes its mind
mid-run — a game you passed on can get re-rated up after it's too late, or one you already own can
pay off, or turn out to be a mistake you're stuck with. When you run low on hours, work a
45-second shift to earn more (it drains your hours as it goes, so shifts are not free); hold the
"Stare at the wall" button to make work-time pass 3x faster at 1.5x the drain rate.

There is no win state. New games keep releasing, prices keep climbing, and the run ends — priced
out — the moment even one more shift's wages couldn't afford anything left unowned. The end screen
scores your collection (curve-weighted so a hidden gem is worth far more than a shelf of junk),
plus bonuses for having held a game through a favorable re-appraisal and for having completed a
full multi-game series, and shows a regret list of games you passed on that turned out to be worth
more than you thought.

## Running it

```
npm install
npm run dev
npm run build
npm run preview
```

## Deploying

The game is a static site that deploys to Vercel:

```
vercel deploy
vercel deploy --prod
```

Live URL: _deploying — see the project's Vercel dashboard_

## Tech

- TypeScript
- React 19
- Vite
- Tailwind CSS 4

Entirely client-side with no server, no database, and no accounts. Game state persists in browser `localStorage`.

## Project docs

- [Spec](specs/001-game-buy-simulator/spec.md)
- [Plan](specs/001-game-buy-simulator/plan.md)
- [Quickstart](specs/001-game-buy-simulator/quickstart.md)

## Known Gaps

A debt register (`.specify/memory/constitution.md`, Principle IV), not a permanent excuse — entries
are removed as they're repaid. None of these are bugs; they are choices, or things nobody has
verified yet.

- **The catalogue is a hand-authored TypeScript constant** (`src/data/catalogue.ts`): 39 games,
  97 listings across 3 storefronts, including 3 real multi-game series. No CMS, no data fetching.
  Adding a game means editing the file.
- **Thumbnails are generated, not designed.** `src/lib/thumbnail.ts` hashes each game id into a
  gradient, motif, and glyph. Zero image assets and no licensing questions, but no game has real
  art.
- **No crash recovery.** There is no error boundary. If the app throws, the fix is to clear
  `localStorage` (key `gbs.run.v1`) and reload. A schema-version bump discards old saves by design.
- **Trivially cheatable.** All state is client-side. Editing `localStorage` or the system clock
  gives unlimited hours. There is no server, so there is nothing to enforce fairness — and for a
  single-player joke, nothing worth enforcing.
- **Pacing is untuned and owned by playtesting, not by this codebase.** The constants in
  `src/lib/config.ts` (starting hours, inflation rate, shift length, re-appraisal frequency,
  franchise/early-adopter multipliers) have not been adjusted since they were first set; a
  headless simulation (`.superpowers/sdd/delightful-twirling-forest/task-7-report.md`) measured
  runs reaching the priced-out ending in as little as 2–5 minutes under a strategy that always
  buys what it can afford, versus roughly 26 minutes if the player never buys or works at all —
  a wide enough range that whether the pacing feels right can only be judged by playing it, not by
  reading the constants.
- **Whether reading the market tells (low review count, a glowing review under a poor aggregate,
  `cult`/`contemplative` traits, avoiding `hype`/`annual-sequel`/`asset-flip`) actually beats
  buying blind is not settled.** Simulated strategy comparisons (same report as above) found a
  strategy that reads those tells scored *lower* on average than one that just buys the
  highest-rated affordable game each time — the tells shift which games a player ends up owning,
  but in that simulation didn't turn into a higher score. This was measured with a scripted
  heuristic, not human play, so it is a data point for a real playtester to weigh in against,
  not a verdict.
- **Announcements are not persisted.** A sale or release toast you never saw is gone on reload.
