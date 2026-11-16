import { useState } from 'react'
import type { DiningView, Reservation } from '../../../api/types'
import type { ExplorerDay } from '../../../api/explorerTypes'
import { formatTime } from '../../../domain/cruise'
import { shortDate } from '../../../domain/explorer/presentation'
import { itinerary } from '../../../domain/sailings'
import { formatMoney } from '../../../domain/money'
import { useSailing } from '../../../hooks/useDemo'
import { t } from '../../../i18n'
import { api } from '../../../runtime'
import { Button } from '../../Button'
import { Dialog } from '../../Dialog'
import { PlanError } from '../../plan/common'
import { useAction } from '../../../hooks/useAction'
import { names } from '../../plan/people'
import { ReservationList, type ReservationItem } from '../Parts'
import { ReservationEditor } from './ReservationEditor'

interface Props {
  venues: ExplorerDay['venues']
  day: number
  /** Only reservations at this venue (a venue's own page); all of the day's when absent. */
  venueId?: string
  view: DiningView
  reload: () => void
  /** Where a reservation's venue page is; absent on the venue's own page. */
  basePath?: string
}

/** The guest's dinner reservations for the chosen day, with Change, Cancel and a button to reserve, wired to the dining service. */
export function DiningReservations({ venues, day, venueId, view, reload, basePath }: Props) {
  const sailing = useSailing()
  const days = itinerary(sailing)
  const [editing, setEditing] = useState<{ mode: 'create' } | { mode: 'move'; r: Reservation } | null>(null)
  const [cancelling, setCancelling] = useState<Reservation | null>(null)
  const title = (id: string) => venues.find((v) => v.venue.id === id)?.venue.title ?? id
  const mine = view.reservations.filter((r) => r.day === day && (!venueId || r.venueId === venueId)).sort((a, b) => a.time.localeCompare(b.time))
  const items: ReservationItem[] = mine.map((r) => ({
    id: r.id, title: title(r.venueId), name: `${title(r.venueId)}, ${formatTime(r.time)}`, to: basePath && !venueId ? `${basePath}/${r.venueId}?day=${day}` : undefined,
    when: `${shortDate(days[r.day - 1]?.date ?? days[0].date)}, ${formatTime(r.time)}`,
    facts: [names(r.guests), r.charge > 0 ? t('dine.charge', { amount: formatMoney(r.charge) }) : t('dine.included'), ...(r.note ? [r.note] : [])],
  }))
  return (
    <>
      <ReservationList
        heading={venueId ? t('exp.res.hereTitle') : t('exp.res.title')} items={items} empty={venueId ? t('exp.res.noneHere') : t('exp.res.none')} readOnly={!view.canBook}
        onChange={(id) => { const r = mine.find((x) => x.id === id); if (r) setEditing({ mode: 'move', r }) }}
        onCancel={(id) => setCancelling(mine.find((x) => x.id === id) ?? null)}
        action={view.canBook && <Button onClick={() => setEditing({ mode: 'create' })}>{t('exp.res.new')}</Button>}
      />
      {editing && (
        <ReservationEditor
          view={view} day={day} venues={venues.filter((v) => v.venue.bookable === 'dining').map((v) => ({ id: v.venue.id, title: v.venue.title }))}
          venueId={venueId} reservation={editing.mode === 'move' ? editing.r : undefined}
          onClose={() => setEditing(null)} onDone={() => { reload() }}
        />
      )}
      {cancelling && <CancelDialog r={cancelling} name={title(cancelling.venueId)} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); reload() }} />}
    </>
  )
}

function CancelDialog({ r, name, onClose, onDone }: { r: Reservation; name: string; onClose: () => void; onDone: () => void }) {
  const cancel = useAction(async () => { await api.plan.dining.cancel(r.id); onDone() })
  return (
    <Dialog title={t('exp.res.cancelTitle')} onClose={onClose}>
      <p>{t('exp.res.cancelBody', { name, time: formatTime(r.time) })}</p>
      <PlanError error={cancel.error} />
      <div className="exp-actions">
        <Button variant="danger" disabled={cancel.busy} onClick={() => void cancel.run()}>{t('exp.res.cancelYes')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('exp.res.cancelNo')}</Button>
      </div>
    </Dialog>
  )
}
