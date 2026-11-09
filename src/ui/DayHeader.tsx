import type { OnboardToday } from '../api/types'
import { itinerary, PORTS } from '../domain/sailings'
import { aboardRingFraction, aboardTone, dayLook, nextCall, routePercent } from '../domain/shipLook'
import { relativeIn } from '../domain/homeLook'
import { formatTemp } from '../domain/readiness'
import { useSailing, useNow } from '../hooks/useDemo'
import { useSettings } from '../hooks/useSettings'
import { t } from '../i18n'
import { LinkButton } from './Button'
import { Card } from './Card'
import { ProgressRing } from './ProgressRing'
import { relativeText } from './relativeText'

const portName = (id: string): string => PORTS[id]?.name ?? id

/** The signature header of the day (L4, F3): a sea day shows the horizon and the route line, a port day the port, the all-aboard tag and a countdown ring, embarkation and disembarkation put the checklist first. */
export function DayHeader({ today }: { today: OnboardToday }) {
  const sailing = useSailing()
  const now = useNow()
  const [settings] = useSettings()
  if (today.day === null) return null
  const days = itinerary(sailing)
  const look = dayLook(today.day, days.length, today.port)
  if (look === 'sea') {
    const next = nextCall(days, today.day)
    return (
      <Card labelledBy="dayhead-h">
        <div className="dayhead dayhead--sea">
          <h2 id="dayhead-h" className="dayhead__title">{t('look.day.sea', { day: today.day })}</h2>
          {next && <p>{t('look.day.sea.next', { port: portName(next) })}</p>}
          <div className="dayhead__route" role="img" aria-label={t('look.day.sea.route', { day: today.day, total: days.length })}>
            <span className="dayhead__routefill" style={{ inlineSize: `${routePercent(today.day, days.length)}%` }} />
          </div>
          <p className="muted">{t('look.day.sea.route', { day: today.day, total: days.length })}</p>
        </div>
      </Card>
    )
  }
  if (look === 'port') {
    const pd = today.portDay
    const left = pd ? Math.max(0, Math.ceil((pd.state.at - now) / 60_000)) : 0
    const gone = pd?.state.level === 'gone'
    const rel = pd && !gone ? relativeIn(pd.state.at - now) : null
    const tone = pd ? aboardTone(left) : 'calm'
    return (
      <Card hero labelledBy="dayhead-h">
        <div className="dayhead dayhead--port">
          <h2 id="dayhead-h" className="dayhead__port">{portName(today.port)}</h2>
          {today.weather && <p className="muted">{t('look.day.port.weather', { summary: today.weather.summary, high: formatTemp(today.weather.highF, settings.units) })}</p>}
          {pd && (
            <p className={`dayhead__tag dayhead__tag--${tone}`}>
              {!gone && <span className="dayhead__ring"><ProgressRing done={aboardRingFraction(left) * 100} total={100} size={32} /></span>}
              <strong>{t('look.day.port.allAboard', { time: pd.allAboardLocal })}</strong>
              {' · '}{gone ? t('look.day.port.gone') : rel ? relativeText(rel) : null}
            </p>
          )}
        </div>
      </Card>
    )
  }
  const key = look === 'embark' ? 'embark' : 'disembark'
  return (
    <Card hero labelledBy="dayhead-h">
      <div className="dayhead">
        <h2 id="dayhead-h" className="dayhead__title">{t(`look.day.${key}`)}</h2>
        <p>{t(`look.day.${key}.body`)}</p>
        <div className="button-row"><LinkButton to={key === 'embark' ? '/home/embarkation' : '/home/disembark'}>{t(`look.day.${key}.go`)}</LinkButton></div>
      </div>
    </Card>
  )
}
