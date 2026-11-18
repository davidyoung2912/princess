import { useNavigate } from 'react-router'
import type { ExplorerDay } from '../../../api/explorerTypes'
import type { SpaAppointment, SpaView } from '../../../api/spaTypes'
import { formatTime } from '../../../domain/cruise'
import { treatmentKey } from '../../../domain/explorer/shortlist'
import { shortDate } from '../../../domain/explorer/presentation'
import { formatMoney } from '../../../domain/money'
import { dinnerDays } from '../../../domain/dining'
import { spaBookingCard } from '../../../domain/explorer/bookingState'
import type { ReservationScope } from '../../../domain/explorer/reservationsByDay'
import { itinerary, PORTS } from '../../../domain/sailings'
import { useExplorerStage } from '../../../hooks/useExplorerStage'
import { lineWords } from '../lineWords'
import { useSailing } from '../../../hooks/useDemo'
import { t, headingCase } from '../../../i18n'
import { Button, LinkButton } from '../../Button'
import { CalendarCheck, CalendarDays } from '../../icons'
import { StatusBadge } from '../../StatusBadge'
import { SaveButton } from '../SaveButton'

interface Props {
  venues: ExplorerDay['venues']
  day: number
  /** On a venue's own page: the treatments there, and a link to My reservations. */
  venueId?: string
  view: SpaView
  /** This day (the default) or every day of the trip. */
  scope?: ReservationScope
}

const BASE = '/spa-explorer'

/**
 * Where the Spa Explorer stands on appointments: a short line about the chosen day (or a line for every day, with a Book a Treatment button where nothing is booked), a button to book and a link to
 * My reservations, where the appointments are listed and changed or cancelled. On a venue's page it lists the treatments there to book or save.
 */
export function SpaReservations({ venues, day, venueId, view, scope = 'day' }: Props) {
  const sailing = useSailing()
  const { stage } = useExplorerStage()
  const card = spaBookingCard(view, stage)
  const days = itinerary(sailing)
  const navigate = useNavigate()
  // Booking is its own page: `book=new` (with `treatment=<id>`) on this screen's address (see SpaScreens).
  const openEditor = (treatment?: string, on = day) => { void navigate(`${venueId ? `${BASE}/${venueId}` : BASE}?day=${on}&book=new${treatment ? `&treatment=${encodeURIComponent(treatment)}` : ''}`) }
  const title = (id: string) => venues.find((v) => v.venue.id === id)?.venue.title ?? id
  const line = (a: SpaAppointment) => `${a.title}, ${formatTime(a.time)}`
  const reason = !card.canReserve && (view.canBook || stage === 'after') ? <p className="muted">{lineWords(card.detail ?? card.headline)}</p> : null
  const all = [...view.appointments].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
  const seeAll = <LinkButton to="/plan/reservations" variant="secondary" icon={CalendarDays}>{t('exp.res.seeAll')}</LinkButton>

  if (scope === 'trip' && !venueId) {
    const nights = [...new Set([...dinnerDays(days.length), ...all.map((a) => a.day)])].sort((a, b) => a - b)
    return (
      <section aria-labelledby="exp-trip-h">
        <h2 id="exp-trip-h">{headingCase(t('exp.trip.title'))}</h2>
        {nights.map((n) => {
          const d = days[n - 1]
          const heading = `${t('plan.day', { n })} · ${shortDate(d?.date ?? days[0].date)} · ${!d || d.port === 'sea' ? t('plan.atSea') : PORTS[d.port].name}`
          const here = all.filter((a) => a.day === n)
          return (
            <div key={n} className="exp-trip__day">
              <h3 id={`exp-trip-${n}`}>{heading}</h3>
              {here.length > 0 ? (
                <p className="exp-trip__none"><StatusBadge kind="booked" label={t('exp.res.confirmed')} /> <span>{here.map((a) => `${line(a)} (${title(a.venueId)})`).join(' · ')}</span></p>
              ) : (
                <p className="exp-trip__none"><span className="muted">{t('exp.trip.none')}</span>{card.canReserve && <Button variant="secondary" icon={CalendarCheck} onClick={() => openEditor(undefined, n)}>{t('exp.trip.bookSpa')}<span className="visually-hidden"> {heading}</span></Button>}</p>
              )}
            </div>
          )
        })}
        {reason}
        <p>{seeAll}</p>
      </section>
    )
  }

  if (!venueId) {
    const mine = all.filter((a) => a.day === day)
    return (
      <section aria-labelledby="exp-res-h">
        <h2 id="exp-res-h">{headingCase(t('spa.mine'))}</h2>
        <p>{mine.length > 0 ? t('spa.summary', { count: mine.length, list: mine.map((a) => `${line(a)} (${title(a.venueId)})`).join(' · ') }) : t('spa.none')}</p>
        <div className="button-row">
          {card.canReserve && <Button icon={CalendarCheck} onClick={() => openEditor()}>{t('spa.new')}</Button>}
          {seeAll}
        </div>
        {reason}
      </section>
    )
  }

  const here = view.treatments.filter((x) => x.venueId === venueId)
  return (
    <>
      <p className="button-row">{seeAll}</p>
      {reason}
      {here.length > 0 && (
        <section aria-labelledby="spa-here-h">
          <h2 id="spa-here-h">{headingCase(t('spa.treatmentsHere'))}</h2>
          <ul className="card-grid">
            {here.map((x) => (
              <li key={x.id} className="card">
                <h3 className="card__title">{x.title}</h3>
                <p>{x.detail}</p>
                <p className="muted">{t('spa.minutes', { n: x.minutes })} · {formatMoney(x.price)}{x.minAge ? ` · ${t('exp.venue.minAge', { age: x.minAge })}` : ''}</p>
                <div className="button-row">
                  {card.canReserve && <Button variant="secondary" icon={CalendarCheck} onClick={() => openEditor(x.id)}>{t('spa.bookThis')}<span className="visually-hidden"> {x.title}</span></Button>}
                  <SaveButton itemKey={treatmentKey(venues[0]?.venue.shipId ?? '', x.id)} title={x.title} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
