# Quickstart & Verification: Game Buy Simulator

This is the manual verification pass required by constitution Principle V. No part of this feature
may be reported complete without running it and observing the results.

## Prerequisites

- Node.js 20+ and npm. Nothing else — no database, no API keys, no accounts, no `.env` file.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Development shortcut: append `?fast` to the URL to compress the **sale and release** intervals
(research D9b). Shift length is never compressed — at 45 seconds it is directly testable, so no
step below relies on faking the timer the feature is about.

```bash
npm run build && npm run preview   # verify the production build
```

## Deploy

```bash
vercel deploy          # preview
vercel deploy --prod   # production
```

Vite is auto-detected. The output is static, so no serverless function is invoked and hosting stays
free. If the Vercel CLI is not installed: `npm i -g vercel`.

## Verification pass

Work top to bottom. Each step names the requirement it proves. Record what you observed, not what
you expected.

1. **First load** — Fresh browser profile (or cleared localStorage). Starting hours are shown, the
   store grid renders with thumbnails, titles, blurbs, and prices. *(FR-001, FR-002, FR-005)*

2. **Buy a game** — Balance drops by exactly the listed price; the card flips to `Owned`; a matching
   history entry appears. *(FR-010, FR-011, FR-012, FR-013)*

3. **Refuse an unaffordable purchase** — Find or spend down to a game you cannot afford. The buy
   control is disabled with a visible reason, and the balance is unchanged. *(FR-004, FR-010)*

4. **Owned across storefronts** — Find a game listed in two stores, buy it in one, switch to the
   other. It shows `Owned` there too and cannot be re-bought. *(FR-009, FR-042)*

5. **Storefront switching** — Cycle all three. Distinct names, taglines, and colors; balance and
   library unchanged. *(FR-006, FR-007, SC-008)*

6. **The shift does not shorten** — Start a shift, solve the puzzle in ~2 seconds. Observe the
   countdown still showing effectively the full ~45 seconds and **no wage paid**. This is the
   central joke; if it fails, the feature is wrong. *(FR-017, FR-018, SC-003)*

6b. **Spacing out accelerates** — Hold the "Stare at the wall" control. The countdown falls about
    three times faster and the balance drains visibly faster; the displayed rate reflects it.
    Release it and both snap back to resting rates immediately. *(FR-051, FR-053, FR-054)*

6c. **Spacing out costs more** — Work one shift entirely at rest and one held down throughout.
    Compare: the spaced shift finishes in roughly a third of the real time and yields a smaller net
    hour gain for the same wage. Time both and record the numbers. *(FR-052, SC-011)*

6d. **The hold cannot be cheated** — Confirm spacing out stops when you navigate away from the work
    view, when the window loses focus, and that it cannot be latched on or left running. Confirm no
    bonus accrues while the tab is closed. *(FR-055, FR-056)*

7. **Live drain** — During the shift, watch the balance falling continuously. On completion it
   jumps by the wage exactly once, and the net change is positive. *(FR-036, FR-037, FR-038)*

8. **Reload mid-shift** — Reload the page halfway through. The countdown resumes at the correct
   remaining time — neither reset nor skipped. Then background the tab for a stretch and return;
   time advanced correctly. Finally, **close the tab entirely** mid-shift and reopen after the
   duration has passed: the shift is complete and the wage is paid. *(FR-020, research D5/D6)*

8b. **Reload after spacing out** — Space out for a few seconds, then reload. Confirm the accumulated
    bonus survived: remaining time and hours drained are both consistent with the pre-reload state.
    Because the baseline and bonus portions drain at different rates, a wrong split shows up as a
    balance that does not match the audit in step 14. *(research D6b, SC-006)*

9. **Death at work** — Start a shift with fewer hours than a resting shift drains (the UI should
   already be warning you). Confirm you die partway through, the wage is never paid, and the game
   over screen appears. Repeat once by closing the tab during such a shift and returning later —
   death must still resolve correctly from the persisted timestamps. *(FR-039, FR-040, FR-049)*

9b. **Death by zoning out** — Start a shift with just enough hours to survive it at rest, then hold
    the spacing-out control throughout. The raised drain must kill you before completion. This is
    the sharpest consequence of the mechanic and the easiest to get wrong. *(FR-052, FR-049)*

10. **Sales** — Wait for a sale. The announcement names it, auto-dismisses, and can be dismissed
    manually. Discounted listings show a badge, struck-through original, and sale price. Buying one
    deducts the **sale** price. Prices restore on expiry, and no game shows a zero or negative
    price. *(FR-022 – FR-028, SC-005)*

11. **New releases** — Play until a release lands. It is announced, appears at full price, and the
    collection progress denominator increases. *(FR-045, FR-046, FR-044, SC-010)*

12. **Timing check** — Stopwatch one resting shift (~45s) and one fully spaced-out shift (~15s).
    Confirm neither pays out early and that no combination of actions other than spacing out moves
    the clock. *(FR-017, FR-051, SC-003)*

13. **Library and history** — With several purchases across stores, confirm every game appears in
    the library, every transaction in history with correct price paid and discount, and the
    hours-spent total is right. Then clear the save and confirm both show empty states rather than
    blank screens. *(FR-029, FR-030, FR-031)*

14. **Balance audit** — At any point, verify:
    `hoursRemaining === startingHours − Σ(pricePaid) − hoursDrained + hoursEarned`,
    including after shifts that mixed resting and spaced-out time.
    History and the run stats give every term. Any discrepancy is a real bug. *(SC-006)*

15. **End states** — Spend to zero for the death screen with accurate run stats. Then, with a
    temporarily raised starting balance, buy out the catalogue to see the victory screen. Restart
    from each and confirm a genuinely fresh run. *(FR-003, FR-032, FR-033, FR-043)*

16. **Restart any time** — Confirm a run can be abandoned mid-play, not only from the end screen —
    the escape hatch for a player stranded below shift cost. *(FR-050)*

17. **Navigation** — Every one of store / work / library / history is reachable from any other in a
    single action, including while a shift runs. *(FR-021, SC-007)*

18. **Production build** — `npm run build && npm run preview`, then re-run steps 2, 6, 6b, and 8
    against the built output. Confirm `?fast` has **no effect** in the production build. *(SC-009)*

19. **Offline** — With the preview running, disable the network and reload. The game still works;
    there are no runtime network requests. *(research D4, Constraints)*

## Optional automated checks

If the balance arithmetic or the wall-clock replay proves fiddly to check by hand, add Vitest cases
for `economy.ts` and `timeEngine.ts` only — both are pure, so a test can simulate a closed tab by
passing a `now` far in the future, and can simulate spacing out by feeding `dt` with the flag set,
which is far faster and more exact than holding a button and watching. The mixed resting/spaced
drain split is the single most likely place for an arithmetic bug. This is the one place the
constitution explicitly permits tests (Principle V); do not test components.

## Known failure modes

- **Save from an older schema** — version mismatch discards it and starts fresh, by design
  (research D7). Clearing localStorage is the documented recovery for anything corrupted.
- **System clock changes** — a player can move their clock forward to skip a shift. Explicitly out
  of scope (spec Assumptions).
