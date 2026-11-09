import { useState } from 'react'
import { alertState, newAlert, removeAlert, setPaused } from '../../domain/fareAlert'
import { formatMoney, type Cents } from '../../domain/money'
import { parseCents } from '../../domain/ledgerSplit'
import { useNow } from '../../hooks/useDemo'
import { newPilotId, usePilot } from '../../hooks/usePilot'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'

/** A fare alert for this sailing and room type (DRM-16): the guest sets a price, and can pause or delete the alert in one tap. It only tells; it never books. */
export function FareAlertCard({ sailingId, category, latest }: { sailingId: string; category: string; latest: Cents | null }) {
  const { state, update } = usePilot()
  const now = useNow()
  const [price, setPrice] = useState('')
  const [bad, setBad] = useState(false)
  const mine = state.alerts.filter((a) => a.sailingId === sailingId && a.category === category)
  const add = () => {
    const cents = parseCents(price)
    const next = cents === null ? null : newAlert({ id: newPilotId(), sailingId, category, belowCents: cents }, now, state.alerts)
    setBad(next === null)
    if (next) { update((s) => ({ ...s, alerts: next })); setPrice('') }
  }
  return (
    <Card labelledBy="fa-h">
      <h2 id="fa-h" className="card__title">{th('fare.title')}</h2>
      <p>{t('fare.alertIntro', { category })}</p>
      {mine.length === 0 && (
        <>
          <Field label={t('fare.price')} hint={t('fare.priceHint')} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} error={bad ? t('fare.bad') : undefined} />
          <Button onClick={add}>{t('fare.add')}</Button>
        </>
      )}
      <ul className="plain-list">
        {mine.map((a) => (
          <li key={a.id}>
            <strong>{t('fare.below', { price: formatMoney(a.belowCents) })}</strong> · {t(`fare.state.${alertState(a, latest)}` as StringKey)}
            <p className="muted">{t('fare.assume', { category: a.category, currency: a.currency })}</p>
            <div className="button-row">
              <Button variant="secondary" aria-pressed={a.paused} onClick={() => update((s) => ({ ...s, alerts: setPaused(s.alerts, a.id, !a.paused) }))}>{a.paused ? t('fare.resume') : t('fare.pause')}</Button>
              <Button variant="tertiary" onClick={() => update((s) => ({ ...s, alerts: removeAlert(s.alerts, a.id) }))}>{t('fare.delete')}</Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
