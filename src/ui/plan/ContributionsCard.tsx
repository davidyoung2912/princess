import { useState } from 'react'
import { payerView, planContributions, setStatus, STATUSES, summary, type ContributionStatus } from '../../domain/contributions'
import { formatCents, parseCents, type SplitState } from '../../domain/ledgerSplit'
import { formatDate } from '../../domain/cruise'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'

/** Invited payers (BOK-10): the organiser splits the booking among people and sees who has paid; each payer sees only their own amount and deadline. No card details are held here. */
export function ContributionsCard({ split, parties, me, organiser, commit }: {
  split: SplitState
  parties: readonly { id: string; name: string }[]
  me: string
  organiser: boolean
  commit: (next: SplitState) => void
}) {
  const [amount, setAmount] = useState('')
  const [due, setDue] = useState('')
  const [bad, setBad] = useState(false)
  const plan = split.contributions
  const create = () => {
    const cents = parseCents(amount)
    const p = cents === null ? null : planContributions(cents, parties, due)
    setBad(p === null)
    if (p) commit({ ...split, contributions: p })
  }
  if (!plan && !organiser) return null
  const mine = plan ? payerView(plan, me) : null
  const sum = plan ? summary(plan) : null
  return (
    <Card labelledBy="contrib-h">
      <h2 id="contrib-h" className="card__title">{th('contrib.title')}</h2>
      {!plan && (
        <>
          <p>{t('contrib.intro')}</p>
          {parties.length < 2 ? <p className="muted">{t('contrib.needTwo')}</p> : (
            <>
              <Field label={t('contrib.total')} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Field label={t('contrib.due')} type="date" value={due} onChange={(e) => setDue(e.target.value)} error={bad ? t('contrib.bad') : undefined} />
              <Button onClick={create}>{t('contrib.create')}</Button>
            </>
          )}
        </>
      )}
      {plan && mine && !organiser && <p role="status">{t('contrib.yours', { amount: formatCents(mine.cents), date: formatDate(mine.due), status: t(`contrib.status.${mine.status}` as StringKey) })}</p>}
      {plan && organiser && sum && (
        <>
          <p role="status">{t('contrib.summary', { paid: sum.paid, pending: sum.pending, failed: sum.failed, left: formatCents(sum.leftCents) })}</p>
          <p>{t('contrib.by', { date: formatDate(plan.due) })}</p>
          <ul className="plain-list">
            {plan.rows.map((r) => (
              <li key={r.payer}>
                <strong>{r.name}</strong> · {formatCents(r.cents)} · {t(`contrib.status.${r.status}` as StringKey)}
                <div className="button-row">
                  {STATUSES.filter((s) => s !== r.status).map((s: ContributionStatus) => (
                    <Button key={s} variant="tertiary" onClick={() => commit({ ...split, contributions: setStatus(plan, r.payer, s) })}>{t(`contrib.mark.${s}` as StringKey)}<span className="visually-hidden"> {r.name}</span></Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <Button variant="tertiary" onClick={() => commit({ ...split, contributions: null })}>{t('contrib.clear')}</Button>
        </>
      )}
      <p className="muted">{t('contrib.noCards')}</p>
    </Card>
  )
}
