import { useMemo } from 'react'
import { wishOf, type SimWeather } from '../domain/autopilot'
import { alternativesFor, applyChanges, basePlan, type Change, type PlanEntry, type PlanRow } from '../domain/planChange'
import { itinerary, portAt, shipZoneOnDate, type ItineraryDay, type Sailing } from '../domain/sailings'
import { addDays, zonedToEpoch } from '../domain/timezones'
import { useNow, useSailing } from './useDemo'
import { usePilot } from './usePilot'
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
  const port = itinerary(sailing)[day - 1].port
  const weather = useSky(sailing.id, day, port)
  return useMemo(() => {
    const d = itinerary(sailing)[day - 1]
    const base = basePlan(sailing, day, wishOf(prefs))
    const changes = all.filter((c) => c.day === day)
    const rows = applyChanges(base, changes)
    const zone = shipZoneOnDate(sailing, d.date)
    return {
      sailing, day, itineraryDay: d, base, changes, rows, alternatives: alternativesFor(sailing, day, wishOf(prefs), rows.map((r) => r.entry.id)),
      weather, dayStartAt: zonedToEpoch(d.date, '00:00', zone), dayEndAt: zonedToEpoch(addDays(d.date, 1), '00:00', zone),
    }
  }, [sailing, day, prefs, all, weather])
}
