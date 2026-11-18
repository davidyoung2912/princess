import type { Reservation } from '../../api/types'
import type { SpaAppointment } from '../../api/spaTypes'
import { formatTime } from '../../domain/cruise'
import { formatMoney } from '../../domain/money'
import { useAction } from '../../hooks/useAction'
import { t } from '../../i18n'
import { api } from '../../runtime'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { PlanError } from '../plan/common'

/** Cancelling a dinner reservation asks first, then cancels it. */
export function DiningCancelDialog({ r, name, onClose, onDone }: { r: Reservation; name: string; onClose: () => void; onDone: () => void }) {
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

/** Cancelling a spa appointment says first whether it is free or what the ship keeps. */
export function SpaCancelDialog({ a, hours, onClose, onDone }: { a: SpaAppointment; hours: number; onClose: () => void; onDone: () => void }) {
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
