import { Link } from 'react-router'
import { formatDate, formatTime } from '../../domain/cruise'
import { PORTS, itinerary, type ItineraryDay } from '../../domain/sailings'
import { useCurrentDay } from '../../hooks/useDayPlan'
import { useSailing } from '../../hooks/useDemo'
import { t } from '../../i18n'
import { StatusBadge } from '../StatusBadge'
import { Anchor, Arrive, Clock, Depart, Plane, Ship, Waves } from '../icons'

/** The icon for the kind of day: boarding, at sea, in port, or going home. */
export const DayIcon = ({ day, last, sea }: { day: number; last: boolean; sea: boolean }) => {
  const Icon = day === 1 ? Ship : last ? Plane : sea ? Waves : Anchor
  return <Icon className="event__day-icon" aria-hidden="true" focusable="false" />
}

/** What one itinerary day says: kind-of-day icon, "Day N" and date, the Today badge, the port and its arrive, all-aboard and depart times. `to` makes the "Day N" part open that day's plan. */
export function ItineraryDayInfo({ d, last, today, to, badge = true }: { d: ItineraryDay; last: boolean; today: boolean; to?: string; badge?: boolean }) {
  const day = (
    <>
      <DayIcon day={d.day} last={last} sea={d.port === 'sea'} /><strong>{t('itin.day', { day: d.day })}</strong>
    </>
  )
  return (
    <>
      <p className="event__time">
        {to ? <Link to={to} className="event__stretch" aria-label={t('itin.open', { day: d.day, date: formatDate(d.date) })}>{day}</Link> : day}{' '}
        <span className="muted">{formatDate(d.date)}</span>
        {today && badge && <span className="event__today"><StatusBadge kind="booked" label={t('itin.today')} /></span>}
      </p>
      <h3 className="event__title">{d.port === 'sea' ? t('onb.atSea') : <Link to={`/home/ports/${d.port}`} className="event__inner-link">{PORTS[d.port]?.name ?? d.port}</Link>}</h3>
      {d.port !== 'sea' && (d.arrive || d.depart) && (
        <ul className="event__times">
          {d.arrive && <li><Arrive aria-hidden="true" focusable="false" />{t('itin.arrive', { time: formatTime(d.arrive) })}</li>}
          {d.arrive && d.allAboard && <li><Clock aria-hidden="true" focusable="false" />{t('itin.aboard', { time: formatTime(d.allAboard) })}</li>}
          {d.depart && <li><Depart aria-hidden="true" focusable="false" />{t('itin.departs', { depart: formatTime(d.depart) })}</li>}
        </ul>
      )}
    </>
  )
}

/** One day of the itinerary as a card; `to` makes the whole card open that day's plan. */
export function ItineraryDayCard({ d, last, today, to }: { d: ItineraryDay; last: boolean; today: boolean; to?: string }) {
  return (
    <li className={`event${to ? ' event--link' : ''}${today ? ' event--now' : ''}`} aria-current={today ? 'date' : undefined}>
      <ItineraryDayInfo d={d} last={last} today={today} to={to} />
    </li>
  )
}

/** The trip itinerary: every day of the sailing with its port and the arrival, all-aboard and departure times (port time), today marked. */
export function ItineraryScreen() {
  const sailing = useSailing()
  const current = useCurrentDay()
  const days = itinerary(sailing)
  return (
    <div className="page">
      <p>{t('itin.intro')} {t('itin.select')}</p>
      <ol className="event-list" data-tour="itin-days">
        {days.map((d) => {
          const isToday = d.day === current
          return (
            <ItineraryDayCard key={d.day} d={d} last={d.day === days.length} today={isToday} to={`/day-details?day=${d.day}`} />
          )
        })}
      </ol>
      <p><Link to="/nautical">{t('route.nautical')}</Link></p>
    </div>
  )
}
