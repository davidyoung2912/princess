import type { ExplorerDay } from '../api/explorerTypes'
import { buildPlanItems } from '../domain/explorer/planItems'
import type { PlanItem } from '../domain/explorer/planTimeline'
import { shipZoneOnDate } from '../domain/sailings'
import { zonedToEpoch } from '../domain/timezones'
import { useDiningView } from '../ui/explorer/dining/diningView'
import { useSpaView } from '../ui/explorer/spa/spaView'
import { useSailing } from './useDemo'
import { useDayTours, useExplorerData } from './useExplorer'
import type { SavedCopy } from './useSavedCopy'

export interface TodayPlan {
  items: PlanItem[]
  /** The six Explorers' answers for the day, for suggesting alternatives. */
  explorers: ExplorerDay[]
  /** The date of the day, "YYYY-MM-DD", once the Explorers have answered. */
  date: string | null
  /** Every source answered (or has an offline copy). */
  ready: boolean
  /** A source has nothing to show and could not be reached. */
  failed: boolean
  retry: () => void
}

/** Everything the guest has on one cruise day: planned events from all six Explorers, dinner reservations, spa appointments and booked shore excursions. */
export function useTodayPlan(day: number): TodayPlan {
  const sailing = useSailing()
  const copies: SavedCopy<ExplorerDay>[] = [
    useExplorerData('dining', day), useExplorerData('entertainment', day), useExplorerData('shopping', day),
    useExplorerData('spa', day), useExplorerData('exercise', day), useExplorerData('activities', day),
  ]
  const dining = useDiningView()
  const spa = useSpaView()
  const tours = useDayTours(day)
  const all = [...copies, dining, spa, tours]
  const explorers = copies.map((c) => c.data).filter((d): d is ExplorerDay => d !== null)
  const items = buildPlanItems({
    day, explorers, dining: dining.data, spa: spa.data, tours: tours.data,
    atMs: (date, time) => zonedToEpoch(date, time, shipZoneOnDate(sailing, date)),
  })
  return {
    items, explorers, date: explorers[0]?.date ?? null,
    ready: all.every((c) => c.data !== null || c.status === 'error'),
    failed: all.some((c) => c.data === null && c.status === 'error'),
    retry: () => all.forEach((c) => c.retry()),
  }
}
