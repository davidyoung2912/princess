import { Link } from 'react-router'
import { formatDate, formatTime } from '../../domain/cruise'
import { PORTS, itinerary } from '../../domain/sailings'
import { useCurrentDay } from '../../hooks/useDayPlan'
import { useSailing } from '../../hooks/useDemo'
import { t } from '../../i18n'
import { StatusBadge } from '../StatusBadge'

/** The trip itinerary: every day of the sailing with its port and the arrival, all-aboard and departure times (port time), today marked. */
export function ItineraryScreen() {
  const sailing = useSailing()
  const current = useCurrentDay()
  const days = itinerary(sailing)
  return (
    <div className="page">
      <p>{t('itin.intro')}</p>
      <ol className="event-list">
        {days.map((d) => {
          const isToday = d.day === current
          return (
            <li key={d.day} className={`event${isToday ? ' event--now' : ''}`} aria-current={isToday ? 'date' : undefined}>
              <p className="event__time"><strong>{t('itin.day', { day: d.day })}</strong> <span className="muted">{formatDate(d.date)}</span> {isToday && <StatusBadge kind="booked" label={t('itin.today')} />}</p>
              <h3 className="event__title">{d.port === 'sea' ? t('onb.atSea') : PORTS[d.port]?.name ?? d.port}</h3>
              {d.arrive && <p className="event__where">{t('itin.times', { arrive: formatTime(d.arrive), aboard: d.allAboard ? formatTime(d.allAboard) : '', depart: d.depart ? formatTime(d.depart) : '' })}</p>}
            </li>
          )
        })}
      </ol>
      <p><Link to="/nautical">{t('route.nautical')}</Link></p>
    </div>
  )
}
