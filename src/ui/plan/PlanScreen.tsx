import { Link } from 'react-router'
import type { PlanDay, PlanEntry } from '../../domain/plan'
import { countBooked } from '../../domain/plan'
import { formatDate, formatTime } from '../../domain/cruise'
import type { PersonaId } from '../../domain/personas'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { names } from './people'

const TOOLS = [
  { to: '/plan/excursions', key: 'route.excursions' },
  { to: '/plan/dining', key: 'route.dining' },
  { to: '/me/packages', key: 'route.packages' },
  { to: '/plan/checklist', key: 'route.checklist' },
  { to: '/plan/packing', key: 'route.packing' },
  { to: '/plan/travel', key: 'route.travel' },
  { to: '/plan/assistance', key: 'route.assistance' },
] as const

/** Everything booked and not yet booked, day by day (PRE-15). */
export function PlanScreen() {
  const plan = useMine(() => api.plan.overview())
  const list = useMine(() => api.plan.checklist.get())
  return (
    <div className="page">
      <h1>{t('route.plan')}</h1>
      <p>{t('plan.intro')}</p>

      <Load state={list}>
        {(c) => (
          <Card labelledBy="check-h">
            <h2 id="check-h" className="card__title">{t('route.checklist')}</h2>
            <p className="progress-line">{t('plan.check.progress', { done: c.progress.done, total: c.progress.total })}</p>
            <progress className="meter" max={c.progress.total} value={c.progress.done} aria-label={t('plan.check.progress', { done: c.progress.done, total: c.progress.total })} />
            {c.next ? <p>{t('plan.check.next', { item: t(`plan.check.item.${c.next.id}` as never) })} <Link to="/plan/checklist">{t('plan.check.open')}</Link></p> : <p>{t('plan.check.allDone')}</p>}
          </Card>
        )}
      </Load>

      <nav aria-labelledby="tools-h">
        <h2 id="tools-h">{t('plan.tools')}</h2>
        <ul className="link-list">{TOOLS.map((x) => <li key={x.to}><Link to={x.to}>{t(x.key)}</Link></li>)}</ul>
      </nav>

      <section aria-labelledby="days-h">
        <h2 id="days-h">{t('plan.days')}</h2>
        <Load state={plan}>
          {(p) => (
            <>
              <p className="muted">{countBooked(p.days) === 0 ? t('plan.nothingYet') : t('plan.booked', { count: countBooked(p.days) })}</p>
              <ol className="day-list">{p.days.map((d) => <DayCard key={d.day} day={d} />)}</ol>
            </>
          )}
        </Load>
      </section>
    </div>
  )
}

function DayCard({ day }: { day: PlanDay }) {
  const id = `day-${day.day}`
  return (
    <li>
      <Card labelledBy={id}>
        <h3 id={id} className="card__title">{t('plan.day', { n: day.day })} · {formatDate(day.date)}</h3>
        <p className="muted">{day.place || t('plan.atSea')}</p>
        {day.entries.length > 0 && <ul className="day-card__entries">{day.entries.map((e) => <Entry key={`${e.kind}-${e.id ?? e.time}`} entry={e} />)}</ul>}
        {day.gaps.includes('tour') && <p className="day-card__gap">{t('plan.gap.tour')} <Link to="/plan/excursions">{t('plan.gap.tourGo')}<span className="visually-hidden"> {t('plan.day', { n: day.day })}</span></Link></p>}
        {day.gaps.includes('dinner') && <p className="day-card__gap">{t('plan.gap.dinner')} <Link to="/plan/dining">{t('plan.gap.dinnerGo')}<span className="visually-hidden"> {t('plan.day', { n: day.day })}</span></Link></p>}
      </Card>
    </li>
  )
}

function Entry({ entry }: { entry: PlanEntry }) {
  const label = entry.kind === 'sail' ? t('plan.entry.sail') : entry.kind === 'allAboard' ? t('plan.entry.allAboard') : entry.kind === 'tour' ? t('plan.entry.tour', { name: entry.name }) : t('plan.entry.dinner', { name: entry.name })
  return (
    <li>
      <span className="day-card__time">{formatTime(entry.time)}</span>
      <span>{label}{entry.guests.length > 0 && <span className="muted"><br />{names(entry.guests as PersonaId[])}</span>}</span>
    </li>
  )
}
