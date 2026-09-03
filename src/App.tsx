import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { CONFIG } from './lib/config'
import { gameReducer, initialRun } from './lib/gameReducer'
import { loadRun, saveRun } from './lib/storage'
import { makePuzzle } from './lib/puzzles'
import { shiftProgress, currentDrainRatePerMs } from './lib/timeEngine'
import {
  availableListings, canAfford, currentPrice, discountFor,
  gameById, isOwned, listingsForStorefront, restingShiftCost, spacedShiftCost,
  canSurviveRestingShift, totalHoursSpent, runStats, storefrontById,
} from './lib/economy'
import { collectionScore, scoreForValue } from './lib/valuation'
import { STOREFRONTS } from './data/catalogue'
import { HoursHeader } from './components/HoursHeader'
import { NavBar, type View } from './components/NavBar'
import { StoreView, type StoreListingVM } from './components/StoreView'
import { WorkView } from './components/WorkView'
import { LibraryView, type LibraryGameVM } from './components/LibraryView'
import { HistoryView } from './components/HistoryView'
import { AnnouncementStack } from './components/Announcement'
import { EndScreen } from './components/EndScreen'
import { Welcome } from './components/Welcome'

// The run is replayed through one TICK before first render (research D6), so a
// player returning to a closed tab sees the correct post-absence state rather
// than a stale balance that visibly corrects itself a moment later.
function bootState() {
  const now = Date.now()
  const saved = loadRun()
  const base = saved ?? initialRun(now, CONFIG, Math.random)
  return gameReducer(base, { type: 'TICK', now, dt: 0, rand: Math.random }, CONFIG)
}

export default function App() {
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof bootState>, a: Parameters<typeof gameReducer>[1]) =>
      gameReducer(s, a, CONFIG),
    undefined,
    bootState,
  )
  const [view, setView] = useState<View>('store')
  const lastTick = useRef(Date.now())

  // Single interval drives every time-based behaviour. It never accumulates
  // state itself — it just asks the pure reducer what is true now.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      const dt = now - lastTick.current
      lastTick.current = now
      dispatch({ type: 'TICK', now, dt, rand: Math.random })
    }, CONFIG.TICK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { saveRun(state) }, [state])

  const now = Date.now()
  const shift = state.activeShift
  const progress = shift ? shiftProgress(shift, now, CONFIG) : null
  const drainPerSecond = shift ? currentDrainRatePerMs(shift, CONFIG) * 1000 : 0
  const spent = totalHoursSpent(state)
  const score = collectionScore(state.ownedGameIds, state.trueValues)

  // Leaving the work view must release the hold — spacing out requires being
  // at your desk, deliberately (FR-055).
  useEffect(() => {
    if (view !== 'work' && state.activeShift?.spacingOut) {
      dispatch({ type: 'SET_SPACING_OUT', spacingOut: false, now: Date.now() })
    }
  }, [view, state.activeShift?.spacingOut])

  const storeListings: StoreListingVM[] = useMemo(() => {
    const avail = new Set(availableListings(state).map(l => l.id))
    return listingsForStorefront(state, state.activeStorefrontId)
      .filter(l => avail.has(l.id))
      .flatMap(listing => {
        const game = gameById(listing.gameId)
        if (!game) return []
        const price = currentPrice(listing, state.activeSale, CONFIG)
        return [{
          game, listing, price, listPrice: listing.price,
          discountPercent: discountFor(listing, state.activeSale),
          owned: isOwned(state, game.id),
          affordable: canAfford(state, price),
          displayedReviews: state.displayedReviews[game.id] ?? [],
        }]
      })
  }, [state])

  const ownedGames: LibraryGameVM[] = useMemo(
    () => state.ownedGameIds.flatMap(id => {
      const game = gameById(id)
      if (!game) return []
      const trueValue = state.trueValues[id]
      return [{ game, trueValue, points: scoreForValue(trueValue) }]
    }),
    [state.ownedGameIds, state.trueValues],
  )

  const historyRows = useMemo(
    () => [...state.history].reverse().map(record => ({
      record,
      gameTitle: gameById(record.gameId)?.title ?? record.gameId,
      storefrontName: storefrontById(record.storefrontId)?.name ?? record.storefrontId,
    })),
    [state.history],
  )

  const stats = runStats(state, now)

  // Welcome and EndScreen are mutually exclusive full-screen overlays (see
  // their own gates below). Whenever either is open, everything else on the
  // page is background content: it must not be focusable or clickable, so
  // Tab can never land on (and Enter/Space never activate) a control hidden
  // underneath the overlay.
  const welcomeVisible = !state.welcomeSeen && state.status === 'playing'
  const endScreenVisible = state.status !== 'playing'
  const overlayOpen = welcomeVisible || endScreenVisible

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div inert={overlayOpen}>
        <HoursHeader
          hoursRemaining={state.hoursRemaining}
          shiftRemainingMs={progress ? progress.remainingMs : null}
          spacingOut={shift?.spacingOut ?? false}
          drainPerSecond={drainPerSecond}
          collectionScore={score}
          cannotAffordShift={!canSurviveRestingShift(state, CONFIG)}
        />
        <NavBar
          view={view}
          onChange={setView}
          onRestart={() => dispatch({ type: 'RESTART', now: Date.now(), rand: Math.random })}
          shiftActive={!!shift}
          status={state.status}
        />

        <main className="max-w-7xl mx-auto p-6">
          {view === 'store' && (
            <StoreView
              storefronts={STOREFRONTS}
              activeStorefrontId={state.activeStorefrontId}
              onSelectStorefront={id => dispatch({ type: 'SET_STOREFRONT', storefrontId: id })}
              listings={storeListings}
              onBuy={listingId => dispatch({ type: 'BUY', listingId, now: Date.now() })}
            />
          )}
          {view === 'work' && (
            <WorkView
              puzzle={shift?.puzzle ?? null}
              puzzleSolved={shift?.puzzleSolvedAt != null}
              shiftActive={!!shift}
              remainingMs={progress?.remainingMs ?? 0}
              fraction={progress?.fraction ?? 0}
              spacingOut={shift?.spacingOut ?? false}
              drainPerSecond={drainPerSecond}
              hoursRemaining={state.hoursRemaining}
              restingCost={restingShiftCost(CONFIG)}
              spacedCost={spacedShiftCost(CONFIG)}
              onStartShift={() =>
                dispatch({ type: 'START_SHIFT', puzzle: makePuzzle(Math.random), now: Date.now() })}
              onSolvePuzzle={answer =>
                dispatch({ type: 'SOLVE_PUZZLE', answer, now: Date.now() })}
              onSetSpacingOut={v =>
                dispatch({ type: 'SET_SPACING_OUT', spacingOut: v, now: Date.now() })}
            />
          )}
          {view === 'library' && <LibraryView games={ownedGames} totalHoursSpent={spent} />}
          {view === 'history' && <HistoryView records={historyRows} totalHoursSpent={spent} />}
        </main>

        <AnnouncementStack
          announcements={state.announcements}
          onDismiss={id => dispatch({ type: 'DISMISS_ANNOUNCEMENT', id })}
        />
      </div>

      {welcomeVisible && (
        <Welcome
          startingHours={CONFIG.STARTING_HOURS}
          restingCost={restingShiftCost(CONFIG)}
          spacedCost={spacedShiftCost(CONFIG)}
          wage={CONFIG.WAGE}
          onDismiss={() => dispatch({ type: 'DISMISS_WELCOME' })}
        />
      )}

      {state.status !== 'playing' && (
        <EndScreen
          status={state.status}
          gamesOwned={stats.gamesOwned}
          hoursSpent={stats.hoursSpent}
          shiftsWorked={stats.shiftsWorked}
          hoursDrained={stats.hoursDrained}
          onRestart={() => dispatch({ type: 'RESTART', now: Date.now(), rand: Math.random })}
        />
      )}
    </div>
  )
}
