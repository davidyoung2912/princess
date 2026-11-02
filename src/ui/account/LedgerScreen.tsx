import { Link } from 'react-router'
import { asFolioView } from '../../api/guards'
import { formatDayMonth } from '../../domain/cruise'

import { formatMoney } from '../../domain/money'
import { buildLedger, groupByDay, ledgerNet, type PaymentRecord } from '../../domain/trustLedger'
import { api } from '../../runtime'
import { usePersona } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Card } from '../Card'
import { BackLink, Saved } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { Load, SupervisedNote } from './parts'
import { personFirstName } from '../../account/context'

/** The trust ledger (XT-07): every payment, charge, credit and covered item in one timeline that cannot lose a line. */
export function LedgerScreen() {
  const me = usePersona()
  const folio = useSavedCopy('folio', me?.booker ?? 'none', () => api.onboard.folio(), asFolioView, [me?.id])
  const pay = useMine(() => api.payments.get())
  return (
    <div className="page">
      <h1>{t('route.ledger')}</h1>
      <p>{t('ledger.intro')}</p>
      {me?.child ? <SupervisedNote booker={personFirstName(me.booker)} /> : (
        <Saved copy={folio}>
          {(f) => (
            <Load state={pay}>
              {(p) => {
                const payments: PaymentRecord[] = p.receipts.map((r) => ({ id: r.id, label: r.label, cents: r.cents, at: r.at, method: r.method }))
                return <Ledger payments={payments} lines={f.lines} />
              }}
            </Load>
          )}
        </Saved>
      )}
      <p className="muted">{t('ledger.covers')}</p>
      <p><Link to="/me/bill">{t('route.bill')}</Link></p>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}

function Ledger({ payments, lines }: { payments: PaymentRecord[]; lines: Parameters<typeof buildLedger>[1] }) {
  const shipTime = useShipTime()
  const entries = buildLedger(payments, lines)
  const days = groupByDay(entries, (at) => new Date(at).toISOString().slice(0, 10))
  if (entries.length === 0) return <Card info><p>{t('ledger.none')}</p></Card>
  return (
    <>
      <p role="status">{t('ledger.count', { count: entries.length, net: formatMoney(ledgerNet(entries)) })}</p>
      {days.map((d) => (
        <section key={d.day} aria-labelledby={`led-${d.day}`}>
          <h2 id={`led-${d.day}`}>{formatDayMonth(d.day)}</h2>
          <ul className="plain-list">
            {d.entries.map((e) => (
              <li key={e.id}>
                <span>{e.label}<small className="muted"> · {t(`ledger.kind.${e.kind}` as StringKey)} · {shipTime(e.at)}</small></span>
                <span className="num">{e.cents < 0 ? t('bill.credit', { amount: formatMoney(-e.cents) }) : e.kind === 'covered' ? t('ledger.covered', { value: formatMoney(e.value ?? 0) }) : formatMoney(e.cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
