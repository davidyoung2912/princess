import { useState } from 'react'
import type { ExcursionOffer, ExcursionsView, TourBooking } from '../../../../shared/api/types'
import { formatMoney } from '../../../../domain/money'
import type { PersonaId } from '../../../../domain/people'
import { useAction } from '../../../../shared/hooks/useAction'
import { t } from '../../../../shared/i18n'
import { api } from '../../../../app/runtime'
import { Banner } from '../../../../shared/ui/Banner'
import { Button } from '../../../../shared/ui/Button'
import { Dialog } from '../../../../shared/ui/Dialog'
import { GuestPicker, PlanError } from '../../../plan/ui/common'

export function GuestDialog({ title, view, initial, submit, error, busy, onClose, onSubmit }: { title: string; view: ExcursionsView; initial: PersonaId[]; submit: string; error: ReturnType<typeof useAction>['error']; busy: boolean; onClose: () => void; onSubmit: (guests: PersonaId[]) => Promise<void> }) {
  const [guests, setGuests] = useState<PersonaId[]>(initial)
  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void onSubmit(guests) }}>
        <GuestPicker legend={t('exc.who')} party={view.party} value={guests} onChange={setGuests} hint={t('exc.whoHint')} />
        <PlanError error={error} />
        <div className="button-row">
          <Button type="submit" disabled={busy || guests.length === 0}>{submit}</Button>
          <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
        </div>
      </form>
    </Dialog>
  )
}

export function ChangeDialog({ booking, view, reload, onClose }: { booking: TourBooking; view: ExcursionsView; reload: () => void; onClose: () => void }) {
  const change = useAction(async (guests: PersonaId[]) => { const v = await api.plan.excursions.changeGuests(booking.id, guests); reload(); return v })
  const here = view.party.filter((g) => booking.guests.includes(g.id))
  return (
    <GuestDialog
      title={t('exc.changeTitle')}
      view={{ ...view, party: here }}
      initial={booking.guests}
      submit={t('exc.saveGuests')}
      error={change.error}
      busy={change.busy}
      onClose={onClose}
      onSubmit={async (guests) => { if (await change.run(guests)) onClose() }}
    />
  )
}

export function CancelDialog({ booking, offer, reload, onClose }: { booking: TourBooking; offer: ExcursionOffer; reload: () => void; onClose: () => void }) {
  const cancel = useAction(async () => { const v = await api.plan.excursions.cancel(booking.id); reload(); return v })
  const free = booking.cancel.free
  return (
    <Dialog title={t('exc.cancelTitle', { name: offer.item.name })} onClose={onClose}>
      {free ? <p>{t('exc.cancelFree', { amount: formatMoney(booking.cancel.refund) })}</p> : <Banner kind="warning" title={t('exc.cancelLate', { fee: formatMoney(booking.cancel.fee) })}><p>{t('exc.cancelLateBody')}</p></Banner>}
      <PlanError error={cancel.error} />
      <div className="button-row">
        <Button variant="danger" disabled={cancel.busy} onClick={async () => { if (await cancel.run()) onClose() }}>{cancel.busy ? t('account.saving') : t('exc.cancelConfirm')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('exc.keep')}</Button>
      </div>
    </Dialog>
  )
}

