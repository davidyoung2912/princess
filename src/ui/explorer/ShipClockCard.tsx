import type { ExplorerDayState } from '../../hooks/useExplorer'
import { itinerary, shipClockChanges } from '../../domain/sailings'
import { useSailing } from '../../hooks/useDemo'
import { t, headingCase } from '../../i18n'
import { Card } from '../Card'
import { ItineraryDayInfo } from '../onboard/ItineraryScreen'

const DAY_MS = 86_400_000

/** The day as the Day Plan page shows it: the kind of day, its date, the port and its arrive, all-aboard and depart times, and a note when the clocks change tonight. */
export function ShipDayInfo({ state }: { state: ExplorerDayState }) {
  const sailing = useSailing()
  const days = itinerary(sailing)
  const day = days[state.day - 1]
  const change = shipClockChanges(sailing).find((c) => c.at > state.nowAt && c.at - state.nowAt <= DAY_MS)
  return (
    <>
      {day && <ItineraryDayInfo d={day} last={state.day === days.length} today={state.day === state.currentDay} />}
      {change && <p className="muted">{change.hours >= 0 ? t('exp.clock.forward', { count: change.hours }) : t('exp.clock.back', { count: -change.hours })}</p>}
    </>
  )
}

/** The day under the header of every Explorer, in its own card. */
export function ShipClockCard({ state }: { state: ExplorerDayState }) {
  return (
    <Card labelledBy="exp-clock-h">
      <h2 id="exp-clock-h" className="visually-hidden">{headingCase(t('exp.clock.title'))}</h2>
      <ShipDayInfo state={state} />
    </Card>
  )
}
