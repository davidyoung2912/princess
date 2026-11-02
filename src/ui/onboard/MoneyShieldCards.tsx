import { Link } from 'react-router'
import type { FolioLine } from '../../domain/folio'
import { canQuestion, drinkLimitPerDay, explainCharge, feeLedger, spendCoach } from '../../domain/moneyShield'
import { computeEntitlements, sourceOf } from '../../domain/entitlements'
import { formatMoney } from '../../domain/money'
import { api } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { usePersona } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Card } from '../Card'

/** "What is this?" under a charge: a plain reason, and a way to question it (XT-02, S7-05). */
export function ExplainLine({ line, questionTo }: { line: FolioLine; questionTo: string }) {
  const e = explainCharge(line)
  return (
    <details className="explain">
      <summary>{t('explain.open')}<span className="visually-hidden"> {line.description}</span></summary>
      <p>{t(`explain.${e.id}` as StringKey, e.params)}</p>
      {canQuestion(line) && <p><Link to={questionTo}>{t('explain.question')}</Link></p>}
    </details>
  )
}

/** Where the charged money went (XT-02): gratuities, bar service, cover charges and purchases, with shares. */
export function FeeLedgerCard({ lines }: { lines: readonly FolioLine[] }) {
  const { rows, total } = feeLedger(lines)
  if (total === 0) return null
  return (
    <Card labelledBy="fees-h">
      <h2 id="fees-h" className="card__title">{t('fees.title')}</h2>
      <dl className="plain-dl">
        {rows.filter((r) => r.cents > 0).map((r) => <div key={r.id}><dt>{t(`fees.${r.id}` as StringKey)}</dt><dd>{formatMoney(r.cents)} · {r.percent}%</dd></div>)}
      </dl>
      <p className="muted">{t('fees.note')}</p>
    </Card>
  )
}

/** How spending is going against the budget, and what the package has covered (S6-06). Informational: it never blames. */
export function SpendCoachCard({ lines, throughDay }: { lines: readonly FolioLine[]; throughDay: number }) {
  const me = usePersona()
  const budget = useAsync(() => api.budget.get(), [me?.id])
  if (!budget.data) return null
  const c = spendCoach(lines, throughDay, budget.data.budget.total)
  const limit = me ? drinkLimitPerDay(computeEntitlements(sourceOf(me)).drinkCapUsd) : null
  return (
    <Card labelledBy="coach-h">
      <h2 id="coach-h" className="card__title">{t('coach.title')}</h2>
      {c.pace === 'notYet' ? <p>{t('coach.notYet')}</p> : (
        <>
          <p role="status">{t(`coach.pace.${c.pace}` as StringKey, { perDay: formatMoney(c.perDay), forecast: formatMoney(c.forecast), limit: formatMoney(c.limit ?? 0) })}</p>
          {c.covered > 0 && <p>{t('coach.covered', { value: formatMoney(c.covered) })}</p>}
          {limit !== null && <p>{t('coach.drinks', { used: c.drinksToday, limit })}</p>}
        </>
      )}
      <p className="muted">{t('coach.note')}</p>
    </Card>
  )
}
