import { Link } from 'react-router'
import { formatDate, formatTime } from '../../domain/cruise'
import { PORTS, itinerary } from '../../domain/sailings'
import { useCurrentDay } from '../../hooks/useDayPlan'
import { useSailing } from '../../hooks/useDemo'
import { t } from '../../i18n'
import { StatusBadge } from '../StatusBadge'
import { Anchor, Arrive, Clock, Depart, Plane, Ship, Waves } from '../icons'

/** The icon for the kind of day: boarding, at sea, in port, or going home. */
const DayIcon = ({ day, last, sea }: { day: number; last: boolean; sea: boolean }) => {
  const Icon = day === 1 ? Ship : last ? Plane : sea ? Waves : Anchor
  return <Icon className="event__day-icon" aria-hidden="true" focusable="false" />
}

/** The trip itinerary: every day of the sailing with its port and the arrival, all-aboard and departure times (port time), today marked. */
export function ItineraryScreen() {
  const sailing = useSailing()
  const current = useCurrentDay()
  const days = itinerary(sailing)
  return (
    <div className="page">
      <p>{t('itin.intro')} {t('itin.select')}</p>
      <ol className="event-list">
        {days.map((d) => {
          const isToday = d.day === current
          return (
            <li key={d.day} className={`event event--link${isToday ? ' event--now' : ''}`} aria-current={isToday ? 'date' : undefined}>
              <p className="event__time"><Link to={`/day-details?day=${d.day}`} className="event__stretch" aria-label={t('itin.open', { day: d.day, date: formatDate(d.date) })}><DayIcon day={d.day} last={d.day === days.length} sea={d.port === 'sea'} /><strong>{t('itin.day', { day: d.day })}</strong></Link> <span className="muted">{formatDate(d.date)}</span> {isToday && <StatusBadge kind="booked" label={t('itin.today')} />}</p>
              <h3 className="event__title">{d.port === 'sea' ? t('onb.atSea') : <Link to={`/home/ports/${d.port}`} className="event__inner-link">{PORTS[d.port]?.name ?? d.port}</Link>}</h3>
              {d.port !== 'sea' && (d.arrive || d.depart) && (
                <ul className="event__times">
                  {d.arrive && <li><Arrive aria-hidden="true" focusable="false" />{t('itin.arrive', { time: formatTime(d.arrive) })}</li>}
                  {d.arrive && d.allAboard && <li><Clock aria-hidden="true" focusable="false" />{t('itin.aboard', { time: formatTime(d.allAboard) })}</li>}
                  {d.depart && <li><Depart aria-hidden="true" focusable="false" />{t('itin.departs', { depart: formatTime(d.depart) })}</li>}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
      <p><Link to="/nautical">{t('route.nautical')}</Link></p>
    </div>
  )
}
