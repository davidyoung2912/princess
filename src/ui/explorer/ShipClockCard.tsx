import type { ExplorerDayState } from '../../hooks/useExplorer'
import { formatTime } from '../../domain/cruise'
import { portAt, portById, shipClockChanges } from '../../domain/sailings'
import { useSailing } from '../../hooks/useDemo'
import { t, headingCase } from '../../i18n'
import { Card } from '../Card'

const DAY_MS = 86_400_000

/** Where the ship is now: "At sea" or "In Cozumel". */
function whereText(port: string): string {
  return port === 'sea' ? t('exp.clock.sea') : t('exp.clock.inPort', { port: portById(port)?.name ?? port })
}

/** The ship's clock under the header of every Explorer: the time on board and where the ship is, and a note when the clocks change tonight. The date bar at the top already gives the day and date. */
export function ShipClockCard({ state }: { state: ExplorerDayState }) {
  const sailing = useSailing()
  const here = portAt(sailing, state.nowAt)
  const change = shipClockChanges(sailing).find((c) => c.at > state.nowAt && c.at - state.nowAt <= DAY_MS)
  return (
    <Card labelledBy="exp-clock-h">
      <h2 id="exp-clock-h" className="visually-hidden">{headingCase(t('exp.clock.title'))}</h2>
      <p className="exp-clock">
        <strong>{t('exp.clock.time', { time: formatTime(state.now) })}</strong> · {whereText(here.port)}
      </p>
      {change && <p className="muted">{change.hours >= 0 ? t('exp.clock.forward', { count: change.hours }) : t('exp.clock.back', { count: -change.hours })}</p>}
    </Card>
  )
}
