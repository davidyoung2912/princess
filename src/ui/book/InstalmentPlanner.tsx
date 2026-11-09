import { useState } from 'react'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/money'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { ActionError } from '../account/parts'

/**
 * Pay in instalments (H19): a schedule of equal monthly payments the guest can follow. It charges nothing; each payment is made later with the
 * normal pay button. Keeping a plan makes the app remind the guest a week before each payment. It stays out of the way when no plan fits.
 */
export function InstalmentPlanner({ number }: { number: string }) {
  const options = useMine(() => api.booking.instalments(number), [number])
  const [count, setCount] = useState<number | null>(null)
  const [auto, setAuto] = useState<boolean | null>(null)
  const save = useAction(async (value: number | null, withAuto: boolean) => {
    await api.booking.setInstalments(number, value, withAuto)
    options.retry()
  })
  const data = options.data
  if (!data || (data.plans.length === 0 && data.chosen === null)) return null
  const shown = count ?? data.chosen
  const wantAuto = auto ?? data.auto === true
  const chosen = data.plans.find((p) => p.count === shown) ?? null
  return (
    <section className="card" aria-labelledby="instalments-h">
      <h2 id="instalments-h">{t('book.instalments.title')}</h2>
      <p className="muted">{t('book.instalments.intro')}</p>
      {data.chosen !== null && data.next && (
        <Banner kind="info" title={t('book.instalments.next', { amount: formatMoney(data.next.cents), date: formatDate(data.next.date) })} />
      )}
      <div role="group" aria-label={t('book.instalments.choose')} className="actions">
        {data.plans.map((p) => (
          <Button key={p.count} variant={p.count === chosen?.count ? 'primary' : 'secondary'} aria-pressed={p.count === chosen?.count} onClick={() => setCount(p.count === shown ? null : p.count)}>
            {t('book.instalments.option', { count: String(p.count) })}
          </Button>
        ))}
      </div>
      {chosen && (
        <>
          <ol>
            {chosen.payments.map((p) => (
              <li key={p.date}>{t('book.instalments.line', { date: formatDate(p.date), amount: formatMoney(p.cents) })}</li>
            ))}
          </ol>
          <label>
            <input type="checkbox" checked={wantAuto} onChange={(e) => setAuto(e.target.checked)} /> {t('book.instalments.auto')}
          </label>
          {wantAuto && <p className="muted">{t('book.instalments.autoNote')}</p>}
          {(chosen.count !== data.chosen || wantAuto !== (data.auto === true)) && <Button disabled={save.busy} onClick={async () => { if ((await save.run(chosen.count, wantAuto)) !== undefined) { setCount(null); setAuto(null) } }}>{t('book.instalments.keep')}</Button>}
        </>
      )}
      {data.chosen !== null && <Button variant="secondary" disabled={save.busy} onClick={async () => { if ((await save.run(null, false)) !== undefined) setCount(null) }}>{t('book.instalments.stop')}</Button>}
      <ActionError error={save.error} />
      <p className="muted">{t('book.instalments.note')}</p>
    </section>
  )
}
