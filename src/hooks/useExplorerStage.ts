import { explorerStage, sailsInDays, type ExplorerStage } from '../domain/explorer/stage'
import { itinerary, shipZoneOnDate, timeForStage } from '../domain/sailings'
import { zonedToEpoch } from '../domain/timezones'
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
