import { PACES, type Pace } from '../../domain/autopilot'
import { PORTS } from '../../domain/sailings'
import { formatMoney } from '../../domain/pricing'
import { useSailing } from '../../hooks/useDemo'
import { useWeek } from '../../hooks/useWeek'
import { FeedWaiting } from '../FeedWaiting'
import { usePilot } from '../../hooks/usePilot'
import { programmeFollows } from '../../pilot/programme'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Card } from '../Card'
import { useState } from 'react'
import { applyWeek } from '../../domain/planning'
import { useNow } from '../../hooks/useDemo'
import { Button } from '../Button'

const BUDGETS = [null, 10_000, 15_000, 25_000] as const

/** Build my week (S4-01): one tap gives a conflict-free week from the pace, mobility, budget and what the guest likes, with the reason for each choice. */
export function WeekPlanner() {
  const { state, update } = usePilot()
  const sailing = useSailing()
  const { prefs } = state
  const week = useWeek(sailing.id, prefs)
  const now = useNow()
  const [applied, setApplied] = useState<number | null>(null)
  const apply = () => { if (!week) return; const r = applyWeek(sailing, week, state.changes, now); void programmeFollows(api.onboard, sailing, prefs, state.changes, r.changes); update((x) => ({ ...x, changes: r.changes })); setApplied(r.applied) }
  const set = (change: Partial<typeof prefs>) => update((s) => ({ ...s, prefs: { ...s.prefs, ...change } }))

  return (
    <Card labelledBy="wk-h">
      <h2 id="wk-h" className="card__title">{t('week.title')}</h2>
      <p>{t('week.intro')}</p>
      <fieldset>
        <legend>{t('week.pace')}</legend>
        {PACES.map((p: Pace) => <label key={p} className="choice"><input type="radio" name="week-pace" checked={prefs.pace === p} onChange={() => set({ pace: p })} /><span>{t(`week.pace.${p}` as StringKey)}</span></label>)}
      </fieldset>
      <label htmlFor="wk-mob">{t('week.mobility')}</label>
      <select id="wk-mob" className="field__input" value={prefs.mobility} onChange={(e) => set({ mobility: e.target.value as typeof prefs.mobility })}>
        {(['any', 'easy', 'wheelchair'] as const).map((m) => <option key={m} value={m}>{t(`week.mobility.${m}` as StringKey)}</option>)}
      </select>
      <label htmlFor="wk-bud">{t('week.budget')}</label>
      <select id="wk-bud" className="field__input" value={prefs.maxTour ?? ''} onChange={(e) => set({ maxTour: e.target.value ? Number(e.target.value) : null })}>
        {BUDGETS.map((b) => <option key={b ?? 'none'} value={b ?? ''}>{b === null ? t('week.budget.none') : t('week.budget.upTo', { amount: formatMoney(b) })}</option>)}
      </select>
      <label className="choice"><input type="checkbox" checked={prefs.withKids} onChange={(e) => set({ withKids: e.target.checked })} /><span>{t('week.kids')}</span></label>
      <label className="choice"><input type="checkbox" checked={prefs.noEarly} onChange={(e) => set({ noEarly: e.target.checked })} /><span>{t('week.noEarly')}</span></label>

      {!week && <FeedWaiting />}
      {week && <ol className="plain-list">
        {week.days.map((d) => (
          <li key={d.day}>
            <strong>{t('week.day', { n: d.day, place: d.port === 'sea' ? t('week.atSea') : PORTS[d.port].name })}</strong>
            <ul className="plain-list">
              {d.items.map((i) => <li key={i.id}>{i.start} {i.title} <span className="muted">({i.why})</span></li>)}
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
