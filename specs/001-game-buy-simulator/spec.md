# Feature Specification: Game Buy Simulator

**Feature Branch**: `001-game-buy-simulator`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "I want to implement a browser game in which the player can buy video games on a simulated store like Steam or the ps store or any other digital game purchasing software service. the player starts with a budget which is in hours-till-death as the currency. if you run out of hours-till-death the game is over. the user can earn more currency by solving extremely simple puzzles but no matter how fast they solve them they have to wait 5 minutes to 'run the clock out at work.' this will replenish their budget so that they can purchase games again. Periodically, games will go on sale. a little announcement will come up on the screen saying something like 'there is a summer sale' or 'some random reason sale!' and random games will go on sale for an arbitrary percentage. the games will have titles, little thumbnails, and prices and a brief simple description of the game. Ideally, there will be multiple 'stores' maybe 2 or 3 that the user can cycle between. they can also check their purchase history and what games they currently own by some sort of inventory system. the play loop is simply buy games, for as cheap as possible until you get low on currency then do the puzzle solving 5 minute video game."

## Clarifications

### Session 2026-09-01

- Q: If a player is alive but has fewer hours left than a full shift will drain, should they be able to recover, or is that state effectively a death sentence? → A: Option B — keep the gamble; being too poor to survive a shift is an unwinnable state the player restarts from. No drain cap, no reduced-cost shift, no debt.
- Q: During a single run, does the catalogue stay fixed, or do new games release over time so the set you need to own keeps growing? → A: Option B — new games release periodically at full price. Owning everything remains the nominal win, but it is NOT required to be achievable; the treadmill is the point. Winning is a joke, not a design goal.
- Q: Should a shift take 5 real minutes? → A: No — a shift is 45 seconds of work-time if the player does nothing. Real-time pacing was slowing the loop without adding to the joke.
- Q: How can the player make work go faster? → A: Hold a "Stare at the wall" button to space out; work-time advances ~3x while held, so a fully spaced-out shift finishes in ~15 real seconds.
- Q: Does spacing out cost anything? → A: Yes — accelerated time drains hours-till-death at a higher rate (~1.5x per unit of work), so zoning out gets you home sooner but costs more of your life for the same wage.


## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and Buy Games (Priority: P1)

A player opens the simulator and sees a storefront of video games, each with a title, thumbnail
image, short description, and a price denominated in hours-till-death. The player's remaining
hours are always visible. Buying a game deducts its price from the remaining hours and adds the
game to the player's library. Games the player already owns are shown as owned and cannot be
bought again.

**Why this priority**: This is the entire premise. A storefront that spends life-hours on games
is a complete, playable, demonstrable experience on its own.

**Independent Test**: Load the game with a starting balance, buy a game from the store, and
confirm the balance drops by the listed price and the game appears as owned.

**Acceptance Scenarios**:

1. **Given** a player with 2,000 hours remaining, **When** they buy a game priced at 40 hours,
   **Then** their remaining balance shows 1,960 hours and the game is marked as owned.
2. **Given** a player viewing a game they already own, **When** they look at that game's listing,
   **Then** the purchase control is replaced by an "Owned" indicator and cannot be activated.
3. **Given** a player with 10 hours remaining, **When** they attempt to buy a game priced at
   40 hours, **Then** the purchase is refused with a message that they cannot afford it and their
   balance is unchanged.

---

### User Story 2 - Work a Shift to Earn Hours (Priority: P1)

When the player is low on hours, they go to work. Work begins with an extremely simple puzzle
(the kind that takes seconds to solve). Solving the puzzle does not end the shift: the player must
then run out the remaining work-time before the shift pays out. Remaining time is visible and
counts down. When it reaches zero, a fixed wage in hours-till-death is added to the balance.
Solving the puzzle faster does not shorten the shift by a single second.

The one thing that does make work go faster is disengaging from it. Holding a "Stare at the wall"
control makes work-time pass roughly three times faster — but the accelerated time burns
hours-till-death at a higher rate, so spacing out gets the player home sooner while costing more of
their life for the same wage.

**Why this priority**: Without an income source, the game ends within a minute. This closes the
core loop and carries the joke: competence buys you nothing, but checking out does — at a price.

**Independent Test**: Start a shift, solve the puzzle immediately, observe the countdown still runs
its full duration, and confirm the wage arrives only on completion. Then run a second shift holding
the spacing-out control throughout, and confirm it finishes in roughly a third of the real time
while costing noticeably more hours.

**Acceptance Scenarios**:

1. **Given** a player starts a shift, **When** they solve the puzzle in 3 seconds, **Then** the
   remaining work-time is effectively unchanged and no wage has been paid.
5. **Given** a shift in progress, **When** the player holds the spacing-out control, **Then**
   remaining work-time falls about three times faster and the balance drains faster than at rest.
6. **Given** the player releases the spacing-out control, **When** they stop holding it, **Then**
   both the countdown and the drain immediately return to their normal rates.
7. **Given** two shifts, one worked at rest and one fully spaced out, **When** both complete,
   **Then** the spaced-out shift finishes in roughly a third of the real time and yields a smaller
   net gain in hours for the same wage.
2. **Given** a shift timer that reaches zero, **When** the shift completes, **Then** the player's
   balance increases by the shift wage and the player returns to the storefront.
3. **Given** a player answers the puzzle incorrectly, **When** they submit, **Then** they are told
   it is wrong and may try again, with a new puzzle or another attempt, without penalty.
4. **Given** a shift is in progress, **When** the player navigates to the store or inventory,
   **Then** the shift continues counting down and cannot be started a second time concurrently.

---

### User Story 3 - Sales and Announcements (Priority: P2)

At random intervals, a sale event begins. An announcement appears on screen naming the sale (for
example "SUMMER SALE" or "Publisher Anniversary Sale!"). A random subset of games is discounted by
a random percentage; discounted games show their original price struck through beside the new
price and a discount badge. Sales run for a limited time and then expire, restoring original
prices.

**Why this priority**: Sales are what turn the loop into a game — the player is now timing
purchases rather than just clicking buy. Valuable, but the core loop works without it.

**Independent Test**: Wait for (or trigger) a sale, confirm the announcement appears, confirm the
affected games show reduced prices, and confirm buying one deducts the discounted price.

**Acceptance Scenarios**:

1. **Given** a sale begins, **When** the announcement appears, **Then** it names the sale and is
   dismissible, and it disappears on its own after a short time.
2. **Given** a game is on sale at 75% off a 40-hour price, **When** the player buys it, **Then**
   10 hours are deducted, not 40.
3. **Given** an active sale, **When** the sale's duration elapses, **Then** discounted games return
   to their original prices and discount badges are removed.

---

### User Story 4 - Multiple Storefronts (Priority: P2)

The player can cycle between 2-3 distinct storefronts, each with its own name, visual identity,
and catalogue of games. The same game may be sold on more than one storefront at different prices,
and sales apply per-storefront, so the player can compare and buy where it is cheapest. The
player's balance and library are shared across all storefronts.

**Why this priority**: Comparison shopping deepens the "buy it as cheap as possible" goal, but a
single storefront is already a complete game.

**Independent Test**: Switch between storefronts and confirm each shows a different catalogue and
branding while the balance and owned library stay consistent.

**Acceptance Scenarios**:

1. **Given** the player is on Storefront A, **When** they switch to Storefront B, **Then** a
   different catalogue and store branding are shown and their hours balance is unchanged.
2. **Given** a game is owned after being bought on Storefront A, **When** the player views that
   same game on Storefront B, **Then** it is shown as owned there too and cannot be re-purchased.

---

### User Story 5 - Library and Purchase History (Priority: P3)

The player can open an inventory view listing every game they own, and a purchase history listing
every transaction with the game name, the storefront, the price paid, the discount applied if any,
and when it was bought. A running total of hours spent on games is shown.

**Why this priority**: This is the payoff of the satire — seeing the total hours of life spent —
but it observes the loop rather than driving it.

**Independent Test**: Buy several games across storefronts, open the inventory and history, and
confirm every purchase is listed with the correct price paid and the totals add up.

**Acceptance Scenarios**:

1. **Given** the player has bought three games, **When** they open the library, **Then** all three
   are listed with title and thumbnail.
2. **Given** a game bought at a discount, **When** the player views purchase history, **Then** the
   entry shows the actual hours paid and indicates it was bought on sale.
3. **Given** the player has bought no games, **When** they open the library, **Then** an empty-state
   message is shown rather than a blank screen.

---

### User Story 6 - Running Out of Time (Priority: P3)

If the player's remaining hours reach zero, the game is over. A game-over screen appears reporting
how the run went — how many games were bought, how many hours were spent, how many shifts were
worked — and offers a restart that resets the balance, library, and history to a fresh run.

**Why this priority**: The lose condition gives the currency meaning, but it is only reachable
after the core loop already works.

**Independent Test**: Spend down to zero hours and confirm the game-over screen appears with
accurate run statistics and that restarting produces a fresh state.

**Acceptance Scenarios**:

1. **Given** a player with 5 hours remaining, **When** a purchase or drain brings them to 0 or
   below, **Then** the game-over screen is shown and no further purchases are possible.
2. **Given** the game-over screen, **When** the player restarts, **Then** the balance returns to the
   starting amount and the library and history are empty.

---

### User Story 7 - The Backlog Outruns You (Priority: P3)

New games keep releasing at full price while the player grinds, so the number of games needed for a
complete collection keeps growing. Progress is shown as owned-out-of-available, and the player
watches the denominator climb. Owning everything simultaneously does end the run in victory, but
nothing guarantees that is reachable — the joke is that it probably is not.

**Why this priority**: This is the thematic payoff, and it is deliberately not balanced. It depends
on buying, working, and the catalogue all existing first.

**Independent Test**: Play long enough to see a new release announced and confirm the collection
progress denominator increases. Separately, with releases disabled and a raised starting balance,
buy out the catalogue and confirm the victory screen appears.

**Acceptance Scenarios**:

1. **Given** an in-progress run, **When** a new game releases, **Then** it is announced, appears in a
   storefront at full price, and the collection progress denominator increases.
2. **Given** the player owns every available game but one, **When** they buy the last one before any
   new release lands, **Then** the victory screen is shown with hours spent, games owned, and shifts
   worked.
3. **Given** an in-progress run, **When** the player views the store, **Then** their progress is
   shown as games owned out of games available.
4. **Given** the victory screen, **When** the player starts a fresh run, **Then** balance, library,
   and history reset to a new run.

---

### Edge Cases

- Purchase attempted with insufficient hours: refused with a clear message; balance unchanged.
- Purchase attempted for a game already owned: not possible; listing shows an owned state.
- A sale begins while the player is mid-work-shift: the announcement is queued or shown, and the
  shift is not interrupted.
- Player switches storefronts or opens the inventory during a shift: the shift timer keeps running.
- Player reloads the page mid-shift: elapsed real time still counts toward the shift, so a reload
  cannot be used to skip or restart the wait.
- Player holds the spacing-out control and then switches views or leaves the window: spacing out
  stops immediately and the shift reverts to the resting rate.
- Player spaces out with barely enough hours to survive a resting shift: the raised drain kills
  them partway through, and the wage is never paid.
- Player holds the spacing-out control through the final moment of the shift: the shift completes
  exactly once and the wage is paid exactly once.
- Player leaves the browser tab in the background during a shift: the shift still completes on
  real elapsed time, not on tab-active time.
- Two sales would overlap: a new sale either replaces or coexists with the current one without
  stacking discounts on the same game to a nonsensical price.
- A discount cannot reduce a price below the minimum sane price (never free, never negative).
- Player owns every game in every catalogue: the storefronts show an all-owned state rather than
  breaking.
- Balance reaching exactly zero counts as game over.
- Balance reaching zero *during* a shift: the run ends at that moment and the wage is never paid.
- Player starts a shift with fewer hours than the shift will drain: allowed, and it kills them
  partway through — the cost of a full shift is shown before they commit.
- Player is alive but cannot afford a full shift: the run is unwinnable and the game says so, while
  still permitting a doomed shift or a manual restart. No mechanism rescues them.
- Player buys the final unowned game in the catalogue: the run ends in victory rather than
  continuing.
- A new game releases at the same moment the player owns everything: the victory check resolves
  first, so the player is not robbed of a win by a race.
- The reserve pool of unreleased games is exhausted: releases stop and the catalogue becomes fixed
  for the remainder of the run.
- A new release lands while a sale is active: the new game is at full price and is not retroactively
  swept into the ongoing sale.
- Player wins while a shift is still running: the shift stops and the victory screen takes over.

## Requirements *(mandatory)*

### Functional Requirements

**Currency and balance**

- **FR-001**: System MUST track a single player balance denominated in hours-till-death and display
  it persistently on every screen.
- **FR-002**: System MUST start a new run with a fixed starting balance of hours.
- **FR-003**: System MUST end the run when the balance reaches zero or below, and MUST block all
  purchases once the run has ended.
- **FR-004**: System MUST prevent the balance from going below zero via a purchase — a purchase the
  player cannot afford MUST be refused rather than allowed to overdraw.

**Storefronts and catalogue**

- **FR-005**: System MUST present each game with a title, a thumbnail image, a one-to-two sentence
  description, and a current price in hours.
- **FR-006**: System MUST provide 3 distinct storefronts, each with its own name, visual identity,
  and catalogue.
- **FR-007**: Users MUST be able to switch between storefronts at any time outside of the game-over
  state, without losing balance, library, or history.
- **FR-008**: System MUST allow the same game to appear on multiple storefronts at different base
  prices.
- **FR-009**: System MUST mark games the player already owns as owned on every storefront that
  lists them, and MUST prevent re-purchase.

**Purchasing**

- **FR-010**: Users MUST be able to buy any listed, affordable, unowned game in a single confirmed
  action.
- **FR-011**: System MUST deduct exactly the currently displayed price — discounted price when a
  sale is active — at the moment of purchase.
- **FR-012**: System MUST add a purchased game to the player's library immediately and record a
  history entry containing the game, the storefront, the price paid, the original price, the
  discount applied if any, and the time of purchase.
- **FR-013**: System MUST give immediate visible feedback on a successful purchase.

**Working shifts**

- **FR-014**: Users MUST be able to start a work shift at any time when no shift is already running
  and the run has not ended.
- **FR-015**: System MUST require the player to solve one trivially simple puzzle to begin the
  shift, drawn from a small set of puzzle types (for example simple arithmetic, click-the-matching
  shape, or type-the-shown-word).
- **FR-016**: System MUST reject an incorrect puzzle answer with feedback and allow further attempts
  at no cost.
- **FR-017**: System MUST run a shift timer of approximately 45 seconds of work-time at rest, MUST
  keep it entirely unaffected by how quickly the puzzle was solved, and MUST display the remaining
  time.
- **FR-018**: System MUST pay a fixed wage in hours to the balance only when the shift timer
  completes, and MUST NOT pay a partial or early wage.
- **FR-019**: System MUST allow only one shift to be in progress at a time.
- **FR-020**: System MUST base baseline shift progress on real elapsed wall-clock time, so that
  reloading the page, backgrounding the tab, or closing it entirely neither skips nor restarts the
  wait. Time spent away accrues at the resting rate only.
- **FR-021**: Users MUST be able to browse storefronts, inventory, and history while a shift is in
  progress, with the remaining shift time visible.
- **FR-051**: Users MUST be able to space out during a shift by holding a dedicated control, which
  MUST advance work-time at approximately three times the resting rate for as long as it is held.
- **FR-052**: System MUST drain hours at a higher rate per unit of work-time while the player is
  spacing out, so that a fully spaced-out shift costs meaningfully more hours than one worked at
  rest for the same wage.
- **FR-053**: System MUST return both the work-time rate and the drain rate to resting values the
  moment the control is released.
- **FR-054**: System MUST make the current rate visible while spacing out, so the player can see
  both the time and the life running out faster.
- **FR-055**: System MUST NOT allow spacing out to be automated, latched, or left running while the
  player is on another view — it MUST require continuous, deliberate holding.
- **FR-056**: System MUST NOT advance work-time faster than the resting rate while the tab is
  closed, backgrounded, or otherwise not being held.

**Sales**

- **FR-022**: System MUST periodically start sale events at randomized intervals during play.
- **FR-023**: System MUST display an on-screen announcement when a sale begins, naming the sale from
  a varied pool of plausible and absurd reasons (for example "Summer Sale", "Publisher Went
  Bankrupt Sale").
- **FR-024**: System MUST dismiss the announcement automatically after a short time, and MUST allow
  the player to dismiss it manually.
- **FR-025**: System MUST apply a randomized discount percentage to a randomized subset of games
  when a sale begins.
- **FR-026**: System MUST show discounted games with a discount badge, the struck-through original
  price, and the sale price.
- **FR-027**: System MUST end each sale after a bounded duration and restore original prices.
- **FR-028**: System MUST NOT allow discounts to produce a price of zero or below, and MUST NOT
  stack multiple discounts on the same game.

**Library, history, and run end**

- **FR-029**: Users MUST be able to view a library of all owned games showing title and thumbnail,
  with an empty state when nothing is owned.
- **FR-030**: Users MUST be able to view a chronological purchase history of every transaction.
- **FR-031**: System MUST display a running total of hours spent on games.
- **FR-032**: System MUST show a game-over screen on reaching zero hours, reporting games bought,
  hours spent, and shifts worked.
- **FR-033**: Users MUST be able to start a fresh run from the game-over screen, resetting balance,
  library, and history.
- **FR-034**: System MUST preserve the player's balance, library, history, and in-progress shift
  across a page reload on the same device and browser.

**Time drain, ownership, and winning**

- **FR-035**: System MUST NOT reduce the balance passively while the player is browsing, idle, or
  viewing their library — outside of a work shift, hours decrease only through purchases.
- **FR-036**: System MUST continuously reduce the balance in real time for the whole duration of a
  work shift, so that working costs the player hours while it earns them.
- **FR-037**: System MUST pay a shift wage strictly greater than the hours drained by a full shift,
  so that a completed shift is always net positive.
- **FR-038**: System MUST display the balance falling live during a shift, so the cost of working is
  visible as it happens.
- **FR-039**: System MUST end the run immediately if the balance reaches zero during a shift, before
  the wage is paid.
- **FR-040**: System MUST allow the player to start a shift even when the drain would exhaust their
  remaining hours before it completes — the gamble is deliberate and MUST NOT be blocked, though the
  system MUST make the current cost of a full shift visible before the player commits.
- **FR-041**: System MUST treat owned games as a collection only, and MUST NOT provide any way to
  play, use, refund, or resell an owned game.
- **FR-042**: System MUST end the run in victory if the player ever owns every distinct game
  available across all storefronts at the same moment. Because an owned game cannot be re-purchased
  (FR-009), the win requires owning each distinct game once, not each listing.
- **FR-043**: System MUST show a victory screen reporting total hours spent, games owned, and shifts
  worked, and MUST offer a fresh run from it.
- **FR-044**: System MUST show the player their collection progress as games owned out of games
  available, where the denominator grows as new games release.
- **FR-045**: System MUST periodically add new games to the storefront catalogues during a run, at
  full price, so that the set required for completion grows over time.
- **FR-046**: System MUST announce a new release on screen when it happens, so the player sees the
  finish line move.
- **FR-047**: System MUST NOT guarantee that completion is achievable. Release pace MAY outrun any
  realistic purchase rate; the victory path exists as a joke and a technicality, not as a balanced
  goal.
- **FR-048**: System MUST NOT provide any floor, cap, subsidy, reduced-cost shift, or debt mechanism
  that guarantees recovery — a player whose balance is below a full shift's drain is in an
  unwinnable state by design.
- **FR-049**: System MUST clearly indicate when the player can no longer afford a full shift at the
  resting drain rate, so that the unwinnable state is legible rather than discovered by dying at
  work. The system MUST also make clear that spacing out raises the cost, so a shift that is
  affordable at rest can still kill a player who zones out through it.
- **FR-050**: Users MUST be able to abandon the current run and start a fresh one at any time, not
  only from the game-over screen, so a stranded player is never forced to spend down to zero.

### Key Entities

- **Player Run**: The current session's state — remaining hours-till-death, games owned, purchase
  history, shifts worked, and whether the run has ended.
- **Game**: A purchasable title with a name, thumbnail image, short description, and base price in
  hours. May be listed on more than one storefront.
- **Storefront**: A named, visually distinct shop with its own catalogue of games and its own base
  prices for them.
- **Listing**: A specific game offered on a specific storefront at a specific base price, carrying
  any currently active discount.
- **Sale Event**: A named, time-bounded promotion with a discount percentage and the set of listings
  it applies to.
- **Purchase Record**: A completed transaction — game, storefront, original price, price paid,
  discount applied, and timestamp.
- **Work Shift**: An in-progress or completed shift — its puzzle, its start time, its fixed
  duration, and the wage it pays on completion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player can go from opening the game to completing their first purchase in under
  30 seconds without instructions.
- **SC-002**: The full core loop — spend down, work a shift, and buy again — is completable, and a
  player holding more hours than a full shift drains can always recover by working. Below that
  threshold recovery is impossible by design, and the game says so plainly rather than letting the
  player discover it by dying.
- **SC-003**: A work shift worked at rest takes about 45 seconds and pays out no earlier,
  regardless of how quickly the puzzle was solved; this holds across page reloads, backgrounded
  tabs, and a fully closed tab. Spacing out throughout brings a shift to roughly 15 seconds and no
  faster.
- **SC-004**: Every puzzle is solvable by an average player in under 10 seconds.
- **SC-005**: At least one sale event occurs within the first 3 minutes of active play, and the
  player can identify the discounted games at a glance.
- **SC-006**: The balance shown on screen always equals the starting balance, minus every price paid
  in purchase history, minus all hours drained by shifts worked or abandoned, plus every completed
  shift's wage — with no discrepancy after any sequence of actions.
- **SC-007**: The player can reach any of store, library, history, or work from any other in a
  single action.
- **SC-008**: Each storefront is distinguishable from the others at a glance by name and visual
  identity.
- **SC-009**: The game is playable start to finish in a modern desktop browser with no installation
  and no account.
- **SC-010**: At least one new game releases within the first 6 minutes of active play, and the
  collection progress indicator visibly reflects the growing denominator.
- **SC-011**: A shift worked entirely at rest yields a larger net gain in hours than one spaced out
  from start to finish, so the speed-up is a real trade rather than a free fast-forward.
- **SC-012**: A player who buys only on sale can afford measurably more games per shift than one who
  buys only at full price, making sale-waiting a worthwhile strategy.

## Assumptions

- **Single player, no accounts**: There is no sign-in, no server-side account, and no multiplayer.
  Progress lives on the player's own device.
- **Starting balance**: A new run starts with a fixed number of hours (a value in the low thousands,
  tuned so that the first few purchases feel affordable and the first shift is needed within a few
  minutes of play). Exact tuning is a design decision, not a requirement.
- **Shift wage**: A completed shift pays a fixed amount of hours, tuned to be worth a small number
  of full-price games — enough to continue, never enough to trivialize the economy.
- **Game catalogue is fixed and fictional**: Games are invented titles with invented descriptions
  and placeholder or generated thumbnails. No real game titles, real box art, or real storefront
  branding are used, to avoid trademark issues. Storefront names are original parodies.
- **Catalogue size**: Roughly 20-40 games total spread across the storefronts — enough that sales
  and comparison shopping matter, small enough to author by hand.
- **Prices are per-game and hand-authored**, ranging widely enough that cheap impulse buys and
  expensive splurges both exist.
- **Sales are client-driven and random**: There is no real-world sale calendar; sale timing, the
  affected games, and the discount percentage are randomized each run.
- **Desktop browser first**: The primary target is a modern desktop browser. Reasonable behaviour on
  mobile is welcome but not a requirement.
- **No sound requirement**: Audio is out of scope unless separately requested.
- **Real-time means wall-clock**: Shift duration is measured against the device clock, accepting
  that a determined player could change their system clock. Preventing that is out of scope.
- **Content is satirical**: The "hours-till-death" framing is dark comedy about spending life on a
  backlog, not a wellness or health feature, and no real-world health claims or data are involved.
- **Shift economy**: A shift drains hours continuously and pays a larger fixed wage on completion,
  netting positive. Values tuned by play: 600 starting hours; a 45-second resting shift draining 45
  hours (1 h/sec) and paying 150 (net +105). Spacing out advances work-time 3x and drains ~1.5x per
  unit of work, so a fully spaced-out shift finishes in ~15 seconds at 4 h/sec, costs 60 hours, and
  nets +90. These are design targets, not requirements, and will be tuned by play.
- **Shift length is game-time, not a real-world bit**: The original conceit was a literal 5-minute
  wait. That was shortened because the joke lives in the puzzle being irrelevant and in zoning out
  being the only thing that helps — neither of which needs five real minutes to land.
- **Completion is not a design goal**: The catalogue does NOT have to be completable. New releases
  may outpace any realistic purchase rate. Prices and wage are tuned for a satisfying buy/work
  rhythm, not for a reachable finish line, which removes economy balancing as a project risk.
- **New releases are periodic and randomized**: A new game appears every few minutes of active play,
  at full price, drawn from a reserve pool held back from the starting catalogue. The reserve is
  finite; when it is exhausted, releases simply stop.
- **Release announcements reuse the sale announcement**: New releases surface through the same
  on-screen toast mechanism as sales, with different wording.
- **No refunds or resale**: Hours spent are gone. There is no way to convert a library back into
  currency.
