import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { BookingView } from '../../api/types'
import { formatDate, sailingRange } from '../../domain/cruise'
import { formatMoney } from '../../domain/pricing'
import { SAILINGS, sailingById } from '../../domain/sailings'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Dialog } from '../Dialog'
import { ActionError, Load } from '../account/parts'
import { CancellationTable } from './Policy'

/** View, change and cancel a booking made here (BOK-08), with the terms in front of the guest before they act. */
export function ManageBooking({ number, onChanged }: { number: string; onChanged: () => void }) {
  const booking = useMine(() => api.booking.get(number), [number])
  const [dialog, setDialog] = useState<'change' | 'cancel' | null>(null)
  return (
    <section aria-labelledby="manage-h">
      <h2 id="manage-h">{t('book.manage.title')}</h2>
      <Load state={booking}>
        {(b) => (
          <>
            <p>{t('book.manage.today', { fee: formatMoney(b.cancel.fee), refund: formatMoney(b.cancel.refund) })}</p>
            <div className="button-row">
              <LinkButton to={`/book/confirmed/${b.number}`} variant="secondary">{t('book.manage.details')}</LinkButton>
              {b.canChange && <Button variant="secondary" onClick={() => setDialog('change')}>{t('book.manage.change')}</Button>}
              {b.canCancel && <Button variant="danger" onClick={() => setDialog('cancel')}>{t('book.manage.cancel')}</Button>}
            </div>
            {!b.canChange && b.canCancel && <p className="muted">{t('book.manage.noChange')} <LinkButton to="/me/contact" variant="tertiary">{t('account.err.contact')}</LinkButton></p>}
            <details>
              <summary>{t('book.manage.terms')}</summary>
              <CancellationTable current={b.cancel.tier} />
            </details>
            {dialog === 'change' && <ChangeDialog number={number} current={b.sailingId} onClose={() => setDialog(null)} onDone={() => { setDialog(null); booking.retry(); onChanged() }} />}
            {dialog === 'cancel' && <CancelDialog b={b} onClose={() => setDialog(null)} />}
          </>
        )}
      </Load>
    </section>
  )
}

function ChangeDialog({ number, current, onClose, onDone }: { number: string; current: string; onClose: () => void; onDone: () => void }) {
  const [target, setTarget] = useState('')
  const preview = useAsync(() => (target ? api.booking.changePreview(number, target) : Promise.resolve(null)), [target])
  const change = useAction((id: string) => api.booking.change(number, id))
  const p = preview.data
  const ok = p?.check === 'ok'
  return (
    <Dialog title={t('book.change.title')} onClose={onClose}>
      <p>{t('book.change.intro')}</p>
      <div className="field">
        <label htmlFor="change-to">{t('book.change.to')}</label>
        <select id="change-to" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">{t('book.choose')}</option>
          {SAILINGS.filter((s) => s.id !== current).map((s) => <option key={s.id} value={s.id}>{sailingRange(s)}</option>)}
        </select>
      </div>
      {target && preview.status === 'loading' && <p role="status" className="muted">{t('discover.loading')}</p>}
      {target && preview.status === 'error' && <p role="alert" className="field__error">{t('book.change.previewFailed')}</p>}
      {p && p.check !== 'ok' && <Banner kind="warning" title={t(`book.change.check.${p.check}` as StringKey)} />}
      {p && ok && (
        <Banner kind="info" title={p.difference === 0 ? t('book.change.same') : p.difference > 0 ? t('book.change.more', { amount: formatMoney(p.difference) }) : t('book.change.less', { amount: formatMoney(-p.difference) })}>
          <p>{t('book.change.newTotal', { total: formatMoney(p.newTotal), date: formatDate(sailingById(target)!.departure) })}</p>
          {!p.cabinKept && <p>{t('book.change.cabinLost')}</p>}
        </Banner>
      )}
      <ActionError error={change.error} />
      <div className="button-row">
        <Button disabled={!ok || change.busy} onClick={async () => { if (await change.run(target)) onDone() }}>{change.busy ? t('account.saving') : t('book.change.confirm')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('book.restart.keep')}</Button>
      </div>
    </Dialog>
  )
}

function CancelDialog({ b, onClose }: { b: BookingView; onClose: () => void }) {
  const navigate = useNavigate()
  const cancel = useAction(() => api.booking.cancel(b.number))
  return (
    <Dialog title={t('book.cancelDialog.title')} onClose={onClose}>
      <p>{t(`book.cancelDialog.${b.cancel.tier}` as StringKey)}</p>
      <dl className="summary">
        <div className="summary__row"><dt>{t('book.cancelDialog.paid')}</dt><dd>{formatMoney(b.paid)}</dd></div>
        <div className="summary__row"><dt>{t('book.cancelDialog.fee')}</dt><dd>{formatMoney(b.cancel.fee)}</dd></div>
        <div className="summary__row"><dt>{t('book.cancelDialog.refund')}</dt><dd>{formatMoney(b.cancel.refund)}</dd></div>
      </dl>
      <ActionError error={cancel.error} />
      <div className="button-row">
        <Button variant="danger" disabled={cancel.busy} onClick={async () => { if (await cancel.run()) navigate('/me/trips') }}>{cancel.busy ? t('account.saving') : t('book.cancelDialog.confirm')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('book.cancelDialog.keep')}</Button>
      </div>
    </Dialog>
  )
}
