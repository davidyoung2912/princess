import { useState } from 'react'
import type { ShowSeats, TicketView } from '../../api/careTypes'
import type { PartyMember } from '../../api/types'
import { placeById } from '../../domain/deck'
import { MAX_SEATS } from '../../domain/tickets'
import type { DatedEvent } from '../../domain/program'
import type { PersonaId } from '../../domain/personas'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { StatusBadge } from '../StatusBadge'
import { GuestPicker, PlanError } from '../plan/common'
import { useShipTime } from './shipTime'

export interface SeatsInfo {
  seats: ShowSeats[]
  tickets: TicketView[]
  party: PartyMember[]
  reload: () => void
}

/** The seats part of an event in the planner (ENT-01): seats left, your seats, and reserve or give back. Nothing for an event with no tickets. */
export function SeatControl({ e, info, canEdit }: { e: DatedEvent; info: SeatsInfo; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  const seat = info.seats.find((s) => s.eventId === e.id)
  const mine = info.tickets.filter((x) => x.eventId === e.id && x.day === e.day)
  const giveBack = useAction(async (id: string) => { await api.shows.cancel(id); info.reload() })
  if (!seat || e.status === 'cancelled') return null
  return (
    <div className="event__seats">
      {seat.left === 0 ? <StatusBadge kind="soldOut" label={t('tix.soldOut')} /> : <span className="tag">{t('tix.left', { count: seat.left })}</span>}
      {mine.map((x) => (
        <p key={x.id} role="status">
          <StatusBadge kind="booked" label={t('tix.yours', { names: x.guests.map((g) => g.name.split(' ')[0]).join(', ') })} />{' '}
          {canEdit && x.canReturn && <Button variant="tertiary" disabled={giveBack.busy} onClick={() => void giveBack.run(x.id)}>{t('tix.return')}<span className="visually-hidden"> {e.title}</span></Button>}
        </p>
      ))}
      <PlanError error={giveBack.error} />
      {canEdit && seat.left > 0 && <Button variant="secondary" onClick={() => setOpen(true)}>{t('tix.reserve')}<span className="visually-hidden"> {e.title}</span></Button>}
      {open && <Reserve e={e} info={info} left={seat.left} onClose={() => setOpen(false)} />}
    </div>
  )
}

function Reserve({ e, info, left, onClose }: { e: DatedEvent; info: SeatsInfo; left: number; onClose: () => void }) {
  const held = new Set(info.tickets.filter((x) => x.eventId === e.id && x.day === e.day).flatMap((x) => x.guests.map((g) => g.id)))
  const eligible = info.party.filter((g) => !held.has(g.id) && (e.age !== 'adults' || g.age >= 18))
  const [guests, setGuests] = useState<PersonaId[]>(eligible.slice(0, 1).map((g) => g.id))
  const shipTime = useShipTime()
  const reserve = useAction(async () => { await api.shows.reserve(e.id, e.day, guests); info.reload(); onClose() })
  const tooMany = guests.length > Math.min(left, MAX_SEATS)
  return (
    <Dialog title={t('tix.title', { title: e.title })} onClose={onClose}>
      <p>{t('tix.when', { time: shipTime(e.startAt), place: placeById(e.placeId)?.name ?? '' })}</p>
      {eligible.length === 0 ? <p>{t('tix.nobody')}</p> : <GuestPicker legend={t('tix.who')} party={eligible} value={guests} onChange={setGuests} hint={t('tix.left', { count: left })} />}
      {tooMany && <p role="alert" className="field__error">{t('plan.err.soldOut')}</p>}
      <PlanError error={reserve.error} />
      <div className="button-row">
        <Button disabled={reserve.busy || guests.length === 0 || tooMany} onClick={() => void reserve.run()}>{t('tix.confirm')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('data.cancel')}</Button>
      </div>
    </Dialog>
  )
}

/** The guest's own tickets, in time order. */
export function MyTickets({ tickets }: { tickets: readonly TicketView[] }) {
  const shipTime = useShipTime()
  if (tickets.length === 0) return null
  return (
    <section aria-labelledby="tickets-h">
      <h3 id="tickets-h">{t('tix.mine')}</h3>
      <ul className="plain-bullets">
        {tickets.map((x) => (
          <li key={x.id}><strong>{t('plan.day', { n: x.day })}, {shipTime(x.startAt)}</strong> {x.title}: {x.guests.map((g) => g.name.split(' ')[0]).join(', ')}{x.status === 'cancelled' ? ` (${t('onb.cancelled')})` : x.status === 'moved' ? ` (${t('onb.moved', { time: shipTime(x.startAt) })})` : ''}</li>
        ))}
      </ul>
    </section>
  )
}
