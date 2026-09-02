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

Live URL: _not yet deployed_

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

_Populated as shortcuts are taken. See task T053._
