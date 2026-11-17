import type { JourneyStage } from '../../routes/hubs'

/** The seven Explorers a guest can reach. Excursions is bookable but is not one of the six `ExplorerKind` pages the daily venue data covers. */
export const EXPLORER_IDS = ['dining', 'excursions', 'spa', 'entertainment', 'shopping', 'exercise', 'activities'] as const
export type ExplorerId = (typeof EXPLORER_IDS)[number]

/** The explorers that take a reservation or a payment. The other four only have events a guest can plan. */
export const BOOKABLE_EXPLORERS: readonly ExplorerId[] = ['dining', 'excursions', 'spa']

/** The four levels of use (plan section 11.1): 0 and 1 are never closed by the stage. */
export type UseLevel = 0 | 1 | 2 | 3 | 4

/**
 * Why an action is open or not, from the server's views. Never a disabled button: each status has a reason in words (and a date where there is one).
 * `open` can act now, `opensOn` will open on a date, `needsBooking` needs a confirmed booking first, `readOnly` the signed-in person may look but not book,
 * `closed` is shut with no date, `finished` the cruise is over.
 */
export type GateStatus = 'open' | 'opensOn' | 'needsBooking' | 'readOnly' | 'closed' | 'finished'

export interface ActionGate {
  status: GateStatus
  /** The date it opens, "YYYY-MM-DD", only for `opensOn`. */
  opensOn?: string
}

/** What the server has said about one Explorer. Null means the server has not answered (offline or loading), which is never read as "open". */
export interface GateFacts {
  /** The guest has a confirmed booking. */
  hasBooking: boolean
  /** The cruise is over. */
  finished: boolean
  /** The server's `canBook` for the signed-in person; null when no view was read. */
  canBook: boolean | null
  /** The booking window, where the kind has one (dining). */
  window?: { open: boolean; opensOn?: string } | null
}

/**
 * The state of the Reserve action for one Explorer, from facts the server gave. The stage is deliberately not an input: it can tighten wording
 * (see `explorerLens`) but never switch an action on or off (plan section 11.2).
 */
export function actionGate(explorer: ExplorerId, f: GateFacts): ActionGate {
  if (!BOOKABLE_EXPLORERS.includes(explorer)) return { status: f.finished ? 'finished' : 'open' }
  if (f.finished) return { status: 'finished' }
  if (!f.hasBooking) return { status: 'needsBooking' }
  if (f.window && !f.window.open) return f.window.opensOn ? { status: 'opensOn', opensOn: f.window.opensOn } : { status: 'closed' }
  if (f.canBook === false) return { status: 'readOnly' }
  if (f.canBook === null) return { status: 'closed' }
  return { status: 'open' }
}

/** The stage table's highest level (plan section 11.3). It is for wording and emphasis only and is never read to enable an action. */
export const STAGE_MAX_LEVEL: Readonly<Record<JourneyStage, UseLevel>> = {
  dream: 1, discover: 1, book: 1, manage: 3, prebook: 4, getToShip: 4, embark: 4, sea: 4, port: 4, disembark: 4, remember: 1,
}
