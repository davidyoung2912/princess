import { Link } from 'react-router'
import { dndNow } from '../../domain/aboardMore'
import { homeNudges } from '../../domain/finishMore'
import { allAboardEpoch, portAt, shipZoneAt } from '../../domain/sailings'
import { stormWatch } from '../../domain/storm'
import { timeIn, dateIn } from '../../domain/timezones'
import { daysBetween } from '../../domain/trip'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useMemory } from '../../hooks/useMemory'
import { usePilot } from '../../hooks/usePilot'
import { useSettings } from '../../hooks/useSettings'
import { t, type StringKey } from '../../i18n'
import { Card } from '../Card'

/**
 * The unprompted cards on Home (briefing, Autopilot proposals, storm notice, back aboard), in one place so they share the guest's daily budget.
 * "Back aboard" is a safety notice and always shows; calm mode, do not disturb and a budget of none hold back the rest (UX-02).
 */
export function NudgeCards({ aboard }: { aboard: boolean }) {
  const now = useNow()
  const sailing = useSailing()
  const [settings] = useSettings()
  const { state } = useMemory()
  const { state: pilot } = usePilot()
  const at = portAt(sailing, now)
  const allAboard = aboard && at.port !== 'sea' && at.day !== null ? allAboardEpoch(sailing, at.day) : null
  const quiet = settings.calm || dndNow(state.aboard.dnd, timeIn(now, shipZoneAt(sailing, now)), 'offers')
  const storm = stormWatch(sailing, daysBetween(dateIn(now, 'America/New_York'), sailing.departure))
  const list = homeNudges({
    budget: settings.nudgesPerDay, quiet,
    backAboardMin: allAboard === null ? null : Math.ceil((allAboard - now) / 60_000),
    storm: aboard ? 'none' : storm.band, stormPhase: storm.phase,
    proposals: pilot.changes.filter((c) => c.status === 'proposed').length,
    briefing: aboard,
  })
  if (list.length === 0) return null
  return (
    <section aria-label={t('nudge.label')}>
      {list.map((n) => (
        <Card key={n.id} labelledBy={`nudge-${n.id}`}>
          <h2 id={`nudge-${n.id}`} className="card__title">{t(`nudge.${n.id}.title` as StringKey, n.params)}</h2>
          <p><Link to={n.path}>{t(`nudge.${n.id}.link` as StringKey)}</Link></p>
        </Card>
      ))}
    </section>
  )
}
