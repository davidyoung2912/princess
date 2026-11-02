import { useCallback, useState, type ReactNode } from 'react'
import { needsConfirm } from '../domain/moneyShield'
import { formatMoney, type Cents } from '../domain/pricing'
import { useSettings } from '../hooks/useSettings'
import { t } from '../i18n'
import { Button } from './Button'
import { Dialog } from './Dialog'

interface Pending { cents: Cents; what: string; run: () => void }

/**
 * Asks before an optional charge when the guest's own setting says to (XT-03). Call `ask(cents, what, run)`: it runs at once when
 * no check is needed, otherwise it opens a dialog with the amount and the choice to go ahead or not. Never use it for safety,
 * a payment the booking requires, or a zero-dollar item.
 */
export function useConfirmCharge(): { ask: (cents: Cents, what: string, run: () => void) => void; dialog: ReactNode } {
  const [settings] = useSettings()
  const [pending, setPending] = useState<Pending | null>(null)
  const ask = useCallback((cents: Cents, what: string, run: () => void) => {
    if (needsConfirm(cents, settings.chargeCheck)) setPending({ cents, what, run })
    else run()
  }, [settings.chargeCheck])
  const dialog = pending ? (
    <Dialog title={t('confirmCharge.title')} onClose={() => setPending(null)}>
      <p>{t('confirmCharge.body', { what: pending.what, amount: formatMoney(pending.cents) })}</p>
      <p className="muted">{t('confirmCharge.where')}</p>
      <div className="button-row">
        <Button onClick={() => { const go = pending.run; setPending(null); go() }}>{t('confirmCharge.go', { amount: formatMoney(pending.cents) })}</Button>
        <Button variant="secondary" onClick={() => setPending(null)}>{t('confirmCharge.cancel')}</Button>
      </div>
    </Dialog>
  ) : null
  return { ask, dialog }
}
