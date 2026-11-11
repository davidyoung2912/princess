import { Link } from 'react-router'
import { asDiningView, asProgramView } from '../../api/guards'
import { placeById } from '../../domain/deck'
import { venueById } from '../../domain/dining'
import { formatTime } from '../../domain/cruise'
import { PORTS, itinerary } from '../../domain/sailings'
import { useCurrentDay } from '../../hooks/useDayPlan'
import { usePersona, useSailing } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, th } from '../../i18n'
import { api } from '../../runtime'
import { Card } from '../Card'
import { Saved } from './common'
import { useShipTime } from './shipTime'

/** Today's plan: where the ship is today, the activities the guest added to their plan, and their dinner reservations, in time order. */
export function TodayPlanScreen() {
  const me = usePersona()
  const day = useCurrentDay()
  const sailing = useSailing()
  const program = useSavedCopy('program', `${me?.id ?? 'none'}:${day}`, () => api.onboard.program(day), asProgramView, [me?.id, day])
  const dining = useSavedCopy('dining', me?.booker ?? 'none', () => api.plan.dining.view(), asDiningView, [me?.id])
  const shipTime = useShipTime()
  const today = itinerary(sailing).find((d) => d.day === day)
  const portName = today ? (today.port === 'sea' ? t('onb.atSea') : PORTS[today.port]?.name ?? today.port) : ''
  return (
    <div className="page">
      <Card hero labelledBy="tp-where">
        <h2 id="tp-where" className="card__title">{th('plan.today.where')}</h2>
        <p>{t('plan.today.day', { day, place: portName })}</p>
      </Card>
      <section aria-labelledby="tp-acts">
        <h2 id="tp-acts">{th('plan.today.acts')}</h2>
        <Saved copy={program}>
          {(view) => {
            const mine = view.events.filter((e) => view.mine.includes(e.id)).sort((a, b) => a.startAt - b.startAt)
            return mine.length === 0 ? <p className="muted">{t('plan.today.none')}</p> : (
              <ul className="event-list">
                {mine.map((e) => (
                  <li key={e.id} className="event">
                    <p className="event__time"><strong>{shipTime(e.startAt)}</strong> <span className="muted">{t('onb.until', { time: shipTime(e.endAt) })}</span></p>
                    <h3 className="event__title">{e.title}</h3>
                    <p className="event__where">{placeById(e.placeId)?.name ?? ''}</p>
                  </li>
                ))}
              </ul>
            )
          }}
        </Saved>
        <p><Link to="/entertainment">{t('route.entertainment')}</Link></p>
      </section>
      <section aria-labelledby="tp-dine">
        <h2 id="tp-dine">{th('plan.today.dining')}</h2>
        <Saved copy={dining}>
          {(view) => {
            const mine = view.reservations.filter((r) => r.day === day).sort((a, b) => a.time.localeCompare(b.time))
            return mine.length === 0 ? <p className="muted">{t('plan.today.noDining')}</p> : (
              <ul className="plain-bullets">{mine.map((r) => <li key={r.id}><strong>{formatTime(r.time)}</strong> {venueById(r.venueId)?.name ?? r.venueId}</li>)}</ul>
            )
          }}
        </Saved>
        <p><Link to="/dining-today">{t('route.diningToday')}</Link></p>
      </section>
    </div>
  )
}
