import type { Cents } from '../money'
import type { DayKind } from '../dayKinds'

/** The six Explorer pages. Today's Plan is the seventh page in the family but is not an Explorer. */
export type ExplorerKind = 'dining' | 'entertainment' | 'shopping' | 'spa' | 'exercise' | 'activities'

export const EXPLORER_KINDS: readonly ExplorerKind[] = ['dining', 'entertainment', 'shopping', 'spa', 'exercise', 'activities']

export const isExplorerKind = (v: unknown): v is ExplorerKind => (EXPLORER_KINDS as readonly unknown[]).includes(v)

/** Ship time "HH:MM" pairs; "24:00" closes at midnight. */
export type Window = readonly [from: string, to: string]

/**
 * When a venue is open, by kind of day. The first rule whose `when` matches the day wins, so list the most specific rule first.
 * `fixed` is a list of windows; `sailaway` opens a number of minutes after the ship sails and closes at `until` (shops and casino: closed alongside).
 */
export type HoursRule =
  | { kind: 'fixed'; when: readonly DayKind[]; windows: readonly Window[]; /** Windows when staff are on duty, for a venue that is open longer (a 24-hour gym). */ staffed?: readonly Window[] }
  | { kind: 'sailaway'; when: readonly DayKind[]; afterMinutes: number; until: string }
  | { kind: 'closed'; when: readonly DayKind[] }

export type Bookable = 'none' | 'dining' | 'spa'

/** One place a guest can go, in one of the Explorers. Text is authored content served by the backend. */
export interface ExplorerVenue {
  id: string
  shipId: string
  explorer: ExplorerKind
  /** What sort of place it is inside its Explorer, for the filter chips ("main", "specialty", "bar"...). */
  kind: string
  title: string
  short: string
  long: string
  placeId: string
  deckLabel: string
  hours: readonly HoursRule[]
  unavailableSince?: string
  cover?: Cents
  minAge?: number
  bookable: Bookable
  /** Authored list position; pins and the filter come on top of it. */
  order: number
}

export type EventStatus = 'on' | 'moved' | 'cancelled'

/** The part of an event the Explorer rules need. Epoch milliseconds, so they never depend on a time zone. */
export interface TimedEvent {
  id: string
  startAt: number
  endAt: number
  status: EventStatus
}
