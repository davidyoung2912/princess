import { explorerStage, sailsInDays, type ExplorerStage } from '../../features/explorer/domain/stage'
import type { AheadInput } from '../../features/explorer/domain/finished'
import { itinerary, shipZoneAt, shipZoneOnDate, timeForStage } from '../../domain/sailings'
import { timeIn, zonedToEpoch } from '../../domain/timezones'
import { useCurrentDay } from './useDayPlan'
import { useNow, useSailing } from './useDemo'

/** Before, during or after the sailing, and the days to go. For wording only; what can be reserved always comes from the server's own views. */
export function useExplorerStage(): { stage: ExplorerStage; sailsIn: number } {
  const sailing = useSailing()
  const nowAt = useNow()
  const days = itinerary(sailing)
  const last = days[days.length - 1]
  const window = { departureAt: timeForStage(sailing, 'embarkation'), endAt: last ? zonedToEpoch(last.date, '12:00', shipZoneOnDate(sailing, last.date)) : 0 }
  return { stage: explorerStage(window, nowAt), sailsIn: sailsInDays(window, nowAt) }
}

/** What `aheadOnly` needs to tell whether the day being looked at is disembark day: the stage, the ship's own day and ship time now. */
export function useAheadInput(day: number): AheadInput {
  const { stage } = useExplorerStage()
  const sailing = useSailing()
  const nowAt = useNow()
  const currentDay = useCurrentDay()
  return { stage, day, currentDay, total: itinerary(sailing).length, nowTime: timeIn(nowAt, shipZoneAt(sailing, nowAt)) }
}
