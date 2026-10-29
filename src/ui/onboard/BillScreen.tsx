import { InCurrency } from '../aboard/MoneyScreen'
import { useState } from 'react'
import { Link } from 'react-router'
import { asFolioView } from '../../api/guards'
import type { FolioView } from '../../api/types'
import { filterFolio, FOLIO_CATEGORIES, NO_FOLIO_FILTER, runningTotals, folioTotals, type FolioCategory, type FolioFilter } from '../../domain/folio'
import { formatDayMonth } from '../../domain/cruise'
import { formatMoney } from '../../domain/pricing'
import { personaById } from '../../domain/personas'
import { itinerary } from '../../domain/sailings'
import { api } from '../../runtime'
import { usePersona, useSailing } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { SupervisedNote } from '../account/parts'
import { BackLink, Saved } from './common'
import { BudgetAlert, BudgetCard } from './BudgetCard'

/** The onboard account, or folio (ACC-01): every charge, credit and package saving, with a running total, search and filters. Kept on the phone so it opens without signal. */
export function BillScreen() {
  const me = usePersona()
  const copy = useSavedCopy('folio', me?.booker ?? 'none', () => api.onboard.folio(), asFolioView, [me?.id])
  return (
    <div className="page">
      <h1>{t('route.bill')}</h1>
      {me?.child ? <SupervisedNote booker={personaById(me.booker)?.firstName ?? ''} /> : <Saved copy={copy}>{(f) => <Folio f={f} />}</Saved>}
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}

function Folio({ f }: { f: FolioView }) {
  const s = useSailing()
  const [filter, setFilter] = useState<FolioFilter>(NO_FOLIO_FILTER)
  const shown = filterFolio(f.lines, filter)
  const running = runningTotals(f.lines)
  const total = folioTotals(f.lines)
  const days = itinerary(s)
  const name = (id: string) => f.guests.find((g) => g.id === id)?.name.split(' ')[0] ?? id
  const set = (patch: Partial<FolioFilter>) => setFilter({ ...filter, ...patch })
  return (
    <>
      <Card hero labelledBy="total-h">
        <h2 id="total-h" className="card__title">{t('bill.total')}</h2>
        <p className="bill__big">{total.balance < 0 ? t('bill.credit', { amount: formatMoney(-total.balance) }) : formatMoney(total.balance)}</p>
        <dl className="plain-dl">
          <div><dt>{t('bill.charges')}</dt><dd>{formatMoney(total.charges)}</dd></div>
          <div><dt>{t('bill.credits')}</dt><dd>{formatMoney(total.credits)}</dd></div>
          <div><dt>{t('bill.covered')}</dt><dd>{formatMoney(total.covered)}</dd></div>
        </dl>
        <InCurrency cents={total.balance} />
        <p className="muted">{f.throughDay === 0 ? t('bill.notYet') : t('bill.through', { day: f.throughDay })}</p>
        <p className="muted">{t('bill.how')} <Link to="/me/payments">{t('route.payments')}</Link></p>
      </Card>

      <BudgetAlert lines={f.lines} />
      <BudgetCard lines={f.lines} />

      <section aria-labelledby="lines-h">
        <h2 id="lines-h">{t('bill.lines')}</h2>
        <div className="field">
          <label htmlFor="bill-q">{t('bill.search')}</label>
          <input id="bill-q" type="search" className="field__input" value={filter.query} onChange={(e) => set({ query: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="bill-cat">{t('bill.category')}</label>
          <select id="bill-cat" className="field__input" value={filter.category ?? ''} onChange={(e) => set({ category: (e.target.value || null) as FolioCategory | null })}>
            <option value="">{t('bill.all')}</option>
            {FOLIO_CATEGORIES.map((c) => <option key={c} value={c}>{t(`bill.cat.${c}` as StringKey)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bill-guest">{t('bill.guest')}</label>
          <select id="bill-guest" className="field__input" value={filter.guest ?? ''} onChange={(e) => set({ guest: e.target.value || null })}>
            <option value="">{t('bill.everyone')}</option>
            {f.guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="chip-row"><Chip pressed={filter.coveredOnly} onToggle={() => set({ coveredOnly: !filter.coveredOnly })}>{t('bill.coveredOnly')}</Chip></div>
        <p role="status" className="muted">{t('bill.count', { count: shown.length })}</p>
        {shown.length === 0 ? <p>{t('bill.none')}</p> : (
          <div className="table-wrap">
            <table className="bill-table">
              <caption className="visually-hidden">{t('bill.lines')}</caption>
              <thead><tr><th scope="col">{t('bill.col.day')}</th><th scope="col">{t('bill.col.what')}</th><th scope="col">{t('bill.col.who')}</th><th scope="col" className="num">{t('bill.col.amount')}</th><th scope="col" className="num">{t('bill.col.running')}</th></tr></thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.id}>
                    <td>{formatDayMonth(days[l.day - 1].date)}</td>
                    <td>{l.description}{l.coveredBy && <small className="muted"><br />{t('bill.coveredBy', { by: t(`bill.by.${l.coveredBy}` as StringKey), value: formatMoney(l.value ?? 0) })}</small>}</td>
                    <td>{name(l.guest)}</td>
                    <td className="num">{l.cents < 0 ? t('bill.credit', { amount: formatMoney(-l.cents) }) : formatMoney(l.cents)}</td>
                    <td className="num">{formatMoney(running[f.lines.indexOf(l)] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">{t('bill.taxes')}</p>
      </section>
    </>
  )
}
