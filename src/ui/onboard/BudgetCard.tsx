import { useState } from 'react'
import { Link } from 'react-router'
import type { FolioLine } from '../../domain/folio'
import { ALERT_LEVELS, MAX_BUDGET, reportBudget, type AlertLevel, type Budget } from '../../domain/budget'
import { formatMoney } from '../../domain/pricing'
import type { BudgetView } from '../../api/careTypes'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { usePersona } from '../../hooks/useDemo'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { ActionError } from '../account/parts'

const dollars = (cents: number | null) => (cents === null ? '' : String(cents / 100))
const toCents = (text: string): number | null => {
  const n = Number(text.replace(/[$,\s]/g, ''))
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

/** The note shown when spending is close to or over a limit, on the bill and on Home (ACC-02). Says nothing when there is no limit or plenty of room. */
export function BudgetAlert({ lines }: { lines: readonly FolioLine[] }) {
  const version = usePersona()?.id
  const view = useAsync(() => api.budget.get(), [version])
  if (!view.data) return null
  const r = reportBudget(view.data.budget, lines)
  if (r.worst === 'none' || r.worst === 'ok') return null
  const over = r.worst === 'over'
  const kid = r.kids.find((k) => k.state === r.worst)
  const name = kid ? view.data.kids.find((k) => k.id === kid.id)?.name.split(' ')[0] ?? '' : ''
  const status = kid && r.total.state !== r.worst ? kid : r.total
  return (
    <Banner kind={over ? 'danger' : 'warning'} title={t(kid && r.total.state !== r.worst ? (over ? 'bud.kidOver' : 'bud.kidNear') : over ? 'bud.over' : 'bud.near', { name, percent: status.percent })} action={<Link to="/me/bill">{t('bud.see')}</Link>}>
      <p>{t('bud.spent', { spent: formatMoney(status.spent), limit: formatMoney(status.limit ?? 0) })}</p>
    </Banner>
  )
}

/** Set a budget for the cruise, and when to be warned (ACC-02). It only warns: nothing is refused at a till. */
export function BudgetCard({ lines }: { lines: readonly FolioLine[] }) {
  const id = usePersona()?.id
  const view = useAsync(() => api.budget.get(), [id])
  if (!view.data) return null
  // The form starts from what is saved; a new key rebuilds it after each save.
  return <BudgetForm key={JSON.stringify(view.data.budget)} data={view.data} lines={lines} saved={view.retry} />
}

function BudgetForm({ data, lines, saved }: { data: BudgetView; lines: readonly FolioLine[]; saved: () => void }) {
  const [total, setTotal] = useState(dollars(data.budget.total))
  const [level, setLevel] = useState<AlertLevel>(data.budget.alertAt)
  const [kids, setKids] = useState<Record<string, string>>(Object.fromEntries(Object.entries(data.budget.kids).map(([id, c]) => [id, dollars(c)])))
  const [bad, setBad] = useState(false)
  const save = useAction(async (budget: Budget) => { await api.budget.save(budget); saved() })
  const { kids: children, canEdit } = data
  const r = reportBudget(data.budget, lines)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const limit = toCents(total)
    const kidLimits: Record<string, number> = {}
    for (const [id, text] of Object.entries(kids)) {
      if (text.trim() === '') continue
      const c = toCents(text)
      if (c === null || c > MAX_BUDGET) { setBad(true); return }
      kidLimits[id] = c
    }
    if (total.trim() !== '' && (limit === null || limit > MAX_BUDGET)) { setBad(true); return }
    setBad(false)
    void save.run({ total: limit, alertAt: level, kids: kidLimits })
  }

  return (
    <Card labelledBy="bud-h">
      <h2 id="bud-h" className="card__title">{t('bud.title')}</h2>
      <p>{t('bud.intro')}</p>
      {r.total.limit !== null && (
        <p role="status"><strong>{t('bud.status', { spent: formatMoney(r.total.spent), limit: formatMoney(r.total.limit), left: formatMoney(r.total.left) })}</strong> {t(`bud.state.${r.total.state}` as 'bud.state.ok')}</p>
      )}
      {canEdit ? (
        <form onSubmit={submit} noValidate>
          <Field label={t('bud.total')} hint={t('bud.total.hint')} inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} error={bad ? t('bud.bad') : undefined} />
          <div className="field">
            <label htmlFor="bud-level">{t('bud.level')}</label>
            <select id="bud-level" className="field__input" value={level} onChange={(e) => setLevel(Number(e.target.value) as AlertLevel)}>
              {ALERT_LEVELS.map((l) => <option key={l} value={l}>{t('bud.level.at', { percent: l })}</option>)}
            </select>
          </div>
          {children.map((k) => (
            <Field key={k.id} label={t('bud.kid', { name: k.name.split(' ')[0] })} hint={t('bud.kid.hint')} inputMode="decimal" value={kids[k.id] ?? ''} onChange={(e) => setKids({ ...kids, [k.id]: e.target.value })} />
          ))}
          <ActionError error={save.error} />
          <Button type="submit" disabled={save.busy}>{t('bud.save')}</Button>
        </form>
      ) : <p className="muted">{t('bud.readOnly')}</p>}
      {r.kids.map((k) => {
        const kid = children.find((c) => c.id === k.id)
        return k.limit === null ? null : <p key={k.id} className="muted">{t('bud.kid.status', { name: kid?.name.split(' ')[0] ?? '', spent: formatMoney(k.spent), limit: formatMoney(k.limit) })}</p>
      })}
      <p className="muted">{t('bud.note')}</p>
    </Card>
  )
}

/** The budget note for Home: reads the bill itself, and says nothing unless a limit is close or passed. */
export function HomeBudgetAlert() {
  const id = usePersona()?.id
  const folio = useAsync(() => api.onboard.folio(), [id])
  return folio.data ? <BudgetAlert lines={folio.data.lines} /> : null
}
