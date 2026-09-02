# Game Buy Simulator

A browser game that satirizes digital storefronts like Steam. Your currency is "hours-till-death"—a dwindling resource. Buy fictional video games from three parody storefronts, watching for sales and managing your inventory. When you run low on hours, work a grueling 45-second shift to earn more (but watch out: it drains your hours). Hold the "Stare at the wall" button to space out and make work-time pass 3x faster—but you'll burn hours 1.5x faster in return. New games keep releasing endlessly, so owning everything is an impossible treadmill. Spend unwisely and you'll run out of hours. Game over.

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

Deliberate shortcuts, recorded rather than hidden (see `.specify/memory/constitution.md`,
Principle III). None of these are bugs; they are choices made to get a proof of concept working.

- **The catalogue is a hand-authored TypeScript constant** (`src/data/catalogue.ts`). No CMS, no
  data fetching. Adding a game means editing the file.
- **Thumbnails are generated, not designed.** `src/lib/thumbnail.ts` hashes each game id into a
  gradient, motif, and glyph. Zero image assets and no licensing questions, but no game has real
  art.
- **No automated tests.** Verification is the manual pass in
  `specs/001-game-buy-simulator/quickstart.md`. The pure economy and time-engine math were checked
  with throwaway scripts rather than a committed suite, so a regression there would not be caught
  automatically.
- **No crash recovery.** There is no error boundary. If the app throws, the fix is to clear
  `localStorage` (key `gbs.run.v1`) and reload. A schema-version bump discards old saves by design.
- **Trivially cheatable.** All state is client-side. Editing `localStorage` or the system clock
  gives unlimited hours. There is no server, so there is nothing to enforce fairness — and for a
  single-player joke, nothing worth enforcing.
- **Economy numbers are tuned by feel, not derived.** The values in `src/lib/config.ts` came from
  playing it. Owning the full catalogue takes roughly 11 shifts, but new releases are designed to
  outpace you, so completion is not guaranteed to be reachable — that is the joke, not an oversight.
- **Desktop-first.** It is usable on mobile but was not designed for it.
- **Announcements are not persisted.** A sale or release toast you never saw is gone on reload.
