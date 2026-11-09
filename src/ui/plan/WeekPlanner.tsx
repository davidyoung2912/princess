import { PACES, type Pace } from '../../domain/autopilot'
import { FieldLabel } from '../Field'
import { PORTS } from '../../domain/sailings'
import { formatMoney } from '../../domain/money'
import { useSailing } from '../../hooks/useDemo'
import { useWeek } from '../../hooks/useWeek'
import { FeedWaiting } from '../FeedWaiting'
import { usePilot } from '../../hooks/usePilot'
import { programmeFollows } from '../../pilot/programme'
import { api } from '../../runtime'
import { t, th, type StringKey } from '../../i18n'
import { Card } from '../Card'
import { useState } from 'react'
import { applyWeek } from '../../domain/planning'
import { useNow } from '../../hooks/useDemo'
import { inRest } from '../../domain/planPolish'
import { useMemory } from '../../hooks/useMemory'
import { Button } from '../Button'

const BUDGETS = [null, 10_000, 15_000, 25_000] as const

/** Build my week (S4-01): one tap gives a conflict-free week from the pace, mobility, budget and what the guest likes, with the reason for each choice. */
export function WeekPlanner() {
  const { state, update } = usePilot()
  const memory = useMemory()
  const sailing = useSailing()
  const { prefs } = state
  const week = useWeek(sailing.id, prefs, memory.state.polish.rest)
  const now = useNow()
  const [applied, setApplied] = useState<number | null>(null)
  const apply = () => { if (!week) return; const r = applyWeek(sailing, week, state.changes, now, memory.state.polish.rest); void programmeFollows(api.onboard, sailing, prefs, state.changes, r.changes); update((x) => ({ ...x, changes: r.changes })); setApplied(r.applied) }
  const set = (change: Partial<typeof prefs>) => update((s) => ({ ...s, prefs: { ...s.prefs, ...change } }))

  return (
    <Card labelledBy="wk-h">
      <h2 id="wk-h" className="card__title">{th('week.title')}</h2>
      <p>{t('week.intro')}</p>
      <fieldset>
        <legend>{t('week.pace')}</legend>
        {PACES.map((p: Pace) => <label key={p} className="choice"><input type="radio" name="week-pace" checked={prefs.pace === p} onChange={() => set({ pace: p })} /><span>{t(`week.pace.${p}` as StringKey)}</span></label>)}
      </fieldset>
      <FieldLabel htmlFor="wk-mob" help={t('helptip.mobility')}>{t('week.mobility')}</FieldLabel>
      <select id="wk-mob" className="field__input" value={prefs.mobility} onChange={(e) => set({ mobility: e.target.value as typeof prefs.mobility })}>
        {(['any', 'easy', 'wheelchair'] as const).map((m) => <option key={m} value={m}>{t(`week.mobility.${m}` as StringKey)}</option>)}
      </select>
      <FieldLabel htmlFor="wk-bud" help={t('helptip.tourLimit')}>{t('week.budget')}</FieldLabel>
      <select id="wk-bud" className="field__input" value={prefs.maxTour ?? ''} onChange={(e) => set({ maxTour: e.target.value ? Number(e.target.value) : null })}>
        {BUDGETS.map((b) => <option key={b ?? 'none'} value={b ?? ''}>{b === null ? t('week.budget.none') : t('week.budget.upTo', { amount: formatMoney(b) })}</option>)}
      </select>
      <label className="choice"><input type="checkbox" checked={prefs.withKids} onChange={(e) => set({ withKids: e.target.checked })} /><span>{t('week.kids')}</span></label>
      <label className="choice"><input type="checkbox" checked={prefs.noEarly} onChange={(e) => set({ noEarly: e.target.checked })} /><span>{t('week.noEarly')}</span></label>

      {!week && <FeedWaiting />}
      {memory.state.polish.rest.length > 0 && <p className="muted">{t('dl4.rest.weekNote', { days: memory.state.polish.rest.map((r) => r.day).join(', ') })}</p>}
      {week && (
        <div className="week-grid table-wrap">
          <table>
            <caption>{t('l7.week.title')}</caption>
            <thead><tr>{week.days.map((d) => <th key={d.day} scope="col">{t('l7.week.day', { n: d.day })}<small className="muted"><br />{d.port === 'sea' ? t('week.atSea') : PORTS[d.port].name}</small></th>)}</tr></thead>
            <tbody><tr>{week.days.map((d) => {
              const items = d.items.filter((i) => !inRest(memory.state.polish.rest, d.day, i.start))
              return <td key={d.day}>{items.length === 0 ? <span className="muted">{t('l7.week.empty')}</span> : <ul className="plain-list">{items.map((i) => <li key={i.id}>{i.start} {i.title}</li>)}</ul>}</td>
            })}</tr></tbody>
          </table>
        </div>
      )}
      {week && <ol className="plain-list week-list">
        {week.days.map((d) => (
          <li key={d.day}>
            <strong>{t('week.day', { n: d.day, place: d.port === 'sea' ? t('week.atSea') : PORTS[d.port].name })}</strong>
            <ul className="plain-list">
              {d.items.filter((i) => !inRest(memory.state.polish.rest, d.day, i.start)).map((i) => <li key={i.id}>{i.start} {i.title} <span className="muted">({i.why})</span></li>)}
            </ul>
            {d.restDay && <p className="muted">{t('week.restDay')}</p>}
            {d.alternative && <p className="muted">{t('week.alternative', { what: d.alternative })}</p>}
          </li>
        ))}
      </ol>}
      <Button onClick={apply} disabled={!week}>{t('week.apply')}</Button>
      {applied !== null && <p role="status">{applied === 0 ? t('week.appliedNone') : t('week.applied', { n: applied })}</p>}
      {week && <p role="status">{t('week.total', { amount: formatMoney(week.totalTours) })}</p>}
    </Card>
  )
}
