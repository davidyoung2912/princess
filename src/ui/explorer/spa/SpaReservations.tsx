import { useState } from 'react'
import type { ExplorerDay } from '../../../api/explorerTypes'
import type { SpaAppointment, SpaView } from '../../../api/spaTypes'
import { formatTime } from '../../../domain/cruise'
import { shortDate } from '../../../domain/explorer/presentation'
import { formatMoney } from '../../../domain/money'
import { itinerary } from '../../../domain/sailings'
import { useAction } from '../../../hooks/useAction'
import { useSailing } from '../../../hooks/useDemo'
import { t, headingCase } from '../../../i18n'
import { api } from '../../../runtime'
import { Button } from '../../Button'
import { Dialog } from '../../Dialog'
import { PlanError } from '../../plan/common'
import { names } from '../../plan/people'
import { ReservationList, type ReservationItem } from '../Parts'
import { SpaEditor } from './SpaEditor'

interface Props {
  venues: ExplorerDay['venues']
  day: number
  /** Only appointments at this venue (a venue's own page); all of the day's when absent. */
  venueId?: string
  view: SpaView
  reload: () => void
  /** Where a venue's page is; absent on the venue's own page. */
  basePath?: string
}

type Editing = { mode: 'create'; treatmentId?: string } | { mode: 'change'; a: SpaAppointment }

/** The guest's spa appointments for the chosen day, with Change, Cancel and a button to book, wired to the spa service. On a venue's page it also lists the treatments there. */
export function SpaReservations({ venues, day, venueId, view, reload, basePath }: Props) {
  const sailing = useSailing()
  const days = itinerary(sailing)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [cancelling, setCancelling] = useState<SpaAppointment | null>(null)
  const title = (id: string) => venues.find((v) => v.venue.id === id)?.venue.title ?? id
  const mine = view.appointments.filter((a) => a.day === day && (!venueId || a.venueId === venueId)).sort((a, b) => a.time.localeCompare(b.time))
  const items: ReservationItem[] = mine.map((a) => ({
    id: a.id, title: a.title, name: `${a.title}, ${formatTime(a.time)}`, to: basePath && !venueId ? `${basePath}/${a.venueId}?day=${day}` : undefined,
    when: `${shortDate(days[a.day - 1]?.date ?? days[0].date)}, ${formatTime(a.time)}`,
    facts: [title(a.venueId), t('spa.minutes', { n: a.minutes }), names(a.guests), t('spa.total', { amount: formatMoney(a.price) }), ...(a.note ? [a.note] : [])],
  }))
  const bookableVenues = venues.filter((v) => v.venue.bookable === 'spa').map((v) => ({ id: v.venue.id, title: v.venue.title }))
  const here = venueId ? view.treatments.filter((x) => x.venueId === venueId) : []
  return (
    <>
      <ReservationList
        heading={venueId ? t('spa.mineHere') : t('spa.mine')} items={items} empty={venueId ? t('spa.noneHere') : t('spa.none')} readOnly={!view.canBook}
        onChange={(id) => { const a = mine.find((x) => x.id === id); if (a) setEditing({ mode: 'change', a }) }}
        onCancel={(id) => setCancelling(mine.find((x) => x.id === id) ?? null)}
        action={view.canBook && <Button onClick={() => setEditing({ mode: 'create' })}>{t('spa.new')}</Button>}
      />
      {here.length > 0 && (
        <section aria-labelledby="spa-here-h">
          <h2 id="spa-here-h">{headingCase(t('spa.treatmentsHere'))}</h2>
          <ul className="card-grid">
            {here.map((x) => (
              <li key={x.id} className="card">
                <h3 className="card__title">{x.title}</h3>
                <p>{x.detail}</p>
                <p className="muted">{t('spa.minutes', { n: x.minutes })} · {formatMoney(x.price)}{x.minAge ? ` · ${t('exp.venue.minAge', { age: x.minAge })}` : ''}</p>
                {view.canBook && <Button variant="secondary" onClick={() => setEditing({ mode: 'create', treatmentId: x.id })}>{t('spa.bookThis')}<span className="visually-hidden"> {x.title}</span></Button>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {editing && (
        <SpaEditor
          view={view} day={day} venues={bookableVenues} venueId={venueId} treatmentId={editing.mode === 'create' ? editing.treatmentId : undefined}
          appointment={editing.mode === 'change' ? editing.a : undefined} onClose={() => setEditing(null)} onDone={reload}
        />
      )}
      {cancelling && <CancelDialog a={cancelling} hours={view.cancelFreeHours} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); reload() }} />}
    </>
  )
}

/** Cancelling says first whether it is free or what the ship keeps. */
function CancelDialog({ a, hours, onClose, onDone }: { a: SpaAppointment; hours: number; onClose: () => void; onDone: () => void }) {
  const cancel = useAction(async () => { await api.plan.spa.cancel(a.id); onDone() })
  const body = a.cancel.free
    ? t('spa.cancelFree', { name: a.title, time: formatTime(a.time) })
    : t('spa.cancelFee', { name: a.title, time: formatTime(a.time), hours, amount: formatMoney(a.cancel.fee) })
  return (
    <Dialog title={t('spa.cancelTitle')} onClose={onClose}>
      <p>{body}</p>
      <PlanError error={cancel.error} />
      <div className="exp-actions">
        <Button variant="danger" disabled={cancel.busy} onClick={() => void cancel.run()}>{t('spa.cancelYes')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('spa.cancelNo')}</Button>
      </div>
    </Dialog>
  )
}
