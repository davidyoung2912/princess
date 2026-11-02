import { useMemo } from 'react'
import { wishOf, type SimWeather } from '../domain/autopilot'
import { applyChanges, type Change, type PlanEntry, type PlanRow } from '../domain/planChange'
import { entriesOf, wishKey, dayPlanFeed, type ShipChange } from '../feeds/dayPlan'
import { itinerary, portAt, shipZoneOnDate, type ItineraryDay, type Sailing } from '../domain/sailings'
import { addDays, zonedToEpoch } from '../domain/timezones'
import { useNow, useSailing } from './useDemo'
import { usePilot } from './usePilot'
import { useFeed } from './useServedFeeds'
import { useSky } from './useSky'

export interface DayPlanView {
  sailing: Sailing
  day: number
  itineraryDay: ItineraryDay
  base: PlanEntry[]
  /** Changes for this day only. */
  changes: Change[]
  rows: PlanRow[]
  alternatives: PlanEntry[]
  /** The ship's own changes to events today (moved or cancelled). */
  shipChanges: ShipChange[]
  /** The server's day has arrived; until then `base`, `rows` and `alternatives` are empty and must not be read as a free day. */
  ready: boolean
  /** The server's forecast for the day; null until it has come. */
  weather: SimWeather | null
  dayStartAt: number
  dayEndAt: number
}

/** The cruise day the demo clock is on, or the first sea day before and after the cruise. */
export function useCurrentDay(): number {
  const sailing = useSailing()
  return portAt(sailing, useNow()).day ?? 2
}

/** One day's plan: the suggested day from the guest's preferences with their accepted changes applied, and the things around it. */
export function useDayPlan(day: number): DayPlanView {
  const sailing = useSailing()
  const { state } = usePilot()
  const { prefs, changes: all } = state
  const { port, date } = itinerary(sailing)[day - 1]
  const weather = useSky(date, port)
  const served = useFeed(dayPlanFeed, sailing.id, day, wishKey(wishOf(prefs)))
  return useMemo(() => {
    const d = itinerary(sailing)[day - 1]
    const base = served ? entriesOf(served.items) : []
    const changes = all.filter((c) => c.day === day)
    const rows = applyChanges(base, changes)
    const zone = shipZoneOnDate(sailing, d.date)
    return {
      sailing, day, itineraryDay: d, base, changes, rows, alternatives: served ? entriesOf(served.alternatives).filter((a) => !rows.some((r) => r.entry.id === a.id)) : [], shipChanges: served?.shipChanges ?? [], ready: !!served,
      weather, dayStartAt: zonedToEpoch(d.date, '00:00', zone), dayEndAt: zonedToEpoch(addDays(d.date, 1), '00:00', zone),
    }
  }, [sailing, day, all, weather, served])
}
