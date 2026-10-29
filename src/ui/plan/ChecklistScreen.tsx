import { Link } from 'react-router'
import type { ChecklistEntry } from '../../domain/checklist'
import { formatDate } from '../../domain/cruise'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { StatusBadge } from '../StatusBadge'
import { Load } from '../account/parts'
import { Back, PlanError } from './common'

/** The pre-cruise checklist on a 90/60/30/14/7/1-day timeline (MNG-07). */
export function ChecklistScreen() {
  const list = useMine(() => api.plan.checklist.get())
  const tick = useAction(async (id: string, done: boolean) => { await api.plan.checklist.tick(id, done); list.retry() })
  return (
    <div className="page">
      <h1>{t('route.checklist')}</h1>
      <p>{t('check.intro')}</p>
      <Load state={list}>
        {(c) => (
          <>
            <p className="progress-line" role="status">{t('plan.check.progress', { done: c.progress.done, total: c.progress.total })}</p>
            <progress className="meter" max={c.progress.total} value={c.progress.done} aria-label={t('plan.check.progress', { done: c.progress.done, total: c.progress.total })} />
            <PlanError error={tick.error} />
            {c.milestones.map((m) => (
              <section key={m.daysBefore} className="milestone" aria-labelledby={`m-${m.daysBefore}`}>
                <h2 id={`m-${m.daysBefore}`}>{t('check.milestone', { count: m.daysBefore })} <span className="muted">· {formatDate(m.due)}</span></h2>
                {m.entries.map((e) => <Row key={e.id} entry={e} busy={tick.busy} onTick={(done) => void tick.run(e.id, done)} />)}
              </section>
            ))}
            <p className="muted">{t('check.reminders')}</p>
          </>
        )}
      </Load>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}

function Row({ entry, busy, onTick }: { entry: ChecklistEntry; busy: boolean; onTick: (done: boolean) => void }) {
  const done = entry.state === 'done'
  const label = t(`plan.check.item.${entry.id}` as never)
  return (
    <div className="check-row">
      {entry.automatic ? (
        <span aria-hidden="true" />
      ) : (
        <input type="checkbox" id={`c-${entry.id}`} className="check-row__box" checked={done} disabled={busy} onChange={() => onTick(!done)} />
      )}
      <div className="check-row__text">
        {entry.automatic ? <strong>{label}</strong> : <label htmlFor={`c-${entry.id}`}><strong>{label}</strong></label>}
        <small>{t(`check.hint.${entry.id}` as never)}</small>
        {entry.to && !done && <Link to={entry.to}>{t('check.go')}<span className="visually-hidden"> {label}</span></Link>}
      </div>
      {done ? <StatusBadge kind="booked" label={entry.automatic ? t('check.state.autoDone') : t('check.state.done')} />
        : entry.state === 'overdue' ? <StatusBadge kind="changed" label={t('check.state.overdue')} />
        : entry.state === 'dueSoon' ? <StatusBadge kind="waitlist" label={t('check.state.dueSoon')} />
        : <StatusBadge kind="ready" label={t('check.state.upcoming', { date: formatDate(entry.due) })} />}
    </div>
  )
}
