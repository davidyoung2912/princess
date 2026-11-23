import type { ExplorerDay } from '../api/explorerTypes'
import { buildPlanItems } from '../../features/explorer/domain/planItems'
import type { PlanItem } from '../../features/explorer/domain/planTimeline'
import type { DayTour } from '../api/types'
import { consideredOnDay } from '../../features/explorer/domain/excursionDay'
import { portById, shipZoneAt, shipZoneOnDate } from '../../domain/sailings'
import { timeIn, zonedToEpoch } from '../../domain/timezones'
import { api } from '../../app/runtime'
import { useMine } from './useMine'
import { useDiningView } from '../../features/explorer/ui/dining/diningView'
import { useSpaView } from '../../features/explorer/ui/spa/spaView'
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
  const excursions = useMine(() => api.plan.excursions.list())
  const saved = useMine(() => api.ahead.saved.list())
  const considering: DayTour[] = excursions.data && saved.data
    ? consideredOnDay(excursions.data, saved.data, day).map((o) => {
      const startAt = zonedToEpoch(o.date, o.item.start, portById(o.item.port)?.zone ?? shipZoneOnDate(sailing, o.date))
      return { id: `plan-${o.item.id}`, excursionId: o.item.id, name: o.item.name, port: o.item.port, meeting: o.item.meeting, day: o.day, date: o.date, start: timeIn(startAt, shipZoneAt(sailing, startAt)), startAt, endAt: startAt + Math.round(o.item.hours * 60) * 60_000 }
    })
    : []
  const all = [...copies, dining, spa, tours]
  const explorers = copies.map((c) => c.data).filter((d): d is ExplorerDay => d !== null)
  const items = buildPlanItems({
    day, explorers, dining: dining.data, spa: spa.data, tours: tours.data, considering,
    atMs: (date, time) => zonedToEpoch(date, time, shipZoneOnDate(sailing, date)),
  })
  return {
    items, explorers, date: explorers[0]?.date ?? null,
    ready: all.every((c) => c.data !== null || c.status === 'error'),
    failed: all.some((c) => c.data === null && c.status === 'error'),
    retry: () => all.forEach((c) => c.retry()),
  }
}
