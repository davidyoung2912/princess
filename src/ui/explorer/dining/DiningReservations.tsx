import { useNavigate } from 'react-router'
import type { DiningView, Reservation } from '../../../api/types'
import type { ExplorerDay } from '../../../api/explorerTypes'
import { formatTime } from '../../../domain/cruise'
import { shortDate } from '../../../domain/explorer/presentation'
import { itinerary, PORTS } from '../../../domain/sailings'
import { dinnerDays } from '../../../domain/dining'
import type { ReservationScope } from '../../../domain/explorer/reservationsByDay'
import { useSailing } from '../../../hooks/useDemo'
import { t, headingCase } from '../../../i18n'
import { Button, LinkButton } from '../../Button'
import { CalendarCheck, CalendarDays } from '../../icons'
import { diningBookingCard } from '../../../domain/explorer/bookingState'
import { useExplorerStage } from '../../../hooks/useExplorerStage'
import { StatusBadge } from '../../StatusBadge'
import { lineWords } from '../lineWords'

const VENUE_BASE = '/dining-today'

interface Props {
  venues: ExplorerDay['venues']
  day: number
  /** On a venue's own page: only the note about why a table cannot be reserved (the page has its own button). */
  venueId?: string
  view: DiningView
  /** This day (the default) or every night of the trip. */
  scope?: ReservationScope
}

/**
 * Where the Dining Explorer stands on reservations: a short line about the chosen day (or a line for every night, with a Book a Table button where nothing is reserved), a button to reserve and a
 * link to My reservations. The list itself, with Change and Cancel, lives in My reservations (`/plan/reservations`), so a dinner is listed in one place.
 */
export function DiningReservations({ venues, day, venueId, view, scope = 'day' }: Props) {
  const sailing = useSailing()
  const { stage } = useExplorerStage()
  const card = diningBookingCard(view, stage)
  const days = itinerary(sailing)
  const navigate = useNavigate()
  const openEditor = (on = day) => { void navigate(`${venueId ? `${VENUE_BASE}/${venueId}` : VENUE_BASE}?day=${on}&reserve=new`) }
  const title = (id: string) => venues.find((v) => v.venue.id === id)?.venue.title ?? id
  const line = (r: Reservation) => `${title(r.venueId)}, ${formatTime(r.time)}`
  const reason = !card.canReserve && (view.canBook || stage === 'after') ? <p className="muted">{lineWords(card.detail ?? card.headline)}</p> : null
  const all = [...view.reservations].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
  const seeAll = <LinkButton to="/plan/reservations" variant="secondary" icon={CalendarDays}>{t('exp.res.seeAll')}</LinkButton>

  if (venueId) return reason

  if (scope === 'trip') {
    const nights = [...new Set([...dinnerDays(days.length), ...all.map((r) => r.day)])].sort((a, b) => a - b)
    return (
      <section aria-labelledby="exp-trip-h">
        <h2 id="exp-trip-h">{headingCase(t('exp.trip.title'))}</h2>
        {nights.map((n) => {
          const d = days[n - 1]
          const heading = `${t('plan.day', { n })} · ${shortDate(d?.date ?? days[0].date)} · ${!d || d.port === 'sea' ? t('plan.atSea') : PORTS[d.port].name}`
          const here = all.filter((r) => r.day === n)
          return (
            <div key={n} className="exp-trip__day">
              <h3 id={`exp-trip-${n}`}>{heading}</h3>
              {here.length > 0 ? (
                <p className="exp-trip__none"><StatusBadge kind="booked" label={t('exp.res.confirmed')} /> <span>{here.map(line).join(' · ')}</span></p>
              ) : (
                <p className="exp-trip__none"><span className="muted">{t('exp.trip.none')}</span>{card.canReserve && <Button variant="secondary" icon={CalendarCheck} onClick={() => openEditor(n)}>{t('exp.trip.book')}<span className="visually-hidden"> {heading}</span></Button>}</p>
              )}
            </div>
          )
        })}
        {reason}
        <p>{seeAll}</p>
      </section>
    )
  }

  const mine = all.filter((r) => r.day === day)
  return (
    <section aria-labelledby="exp-res-h">
      <h2 id="exp-res-h">{headingCase(t('exp.res.title'))}</h2>
      <p>{mine.length > 0 ? t('exp.res.summary', { count: mine.length, list: mine.map(line).join(' · ') }) : t('exp.res.none')}</p>
      <div className="button-row">
        {card.canReserve && <Button icon={CalendarCheck} onClick={() => openEditor()}>{t('exp.res.new')}</Button>}
        {seeAll}
      </div>
      {reason}
    </section>
  )
}
