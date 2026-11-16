import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { ExplorerEvent, HoursDay, MealMenu } from '../../api/explorerTypes'
import type { DietaryId } from '../../domain/account'
import { formatTime } from '../../domain/cruise'
import { NEEDS_ASKING, dishSuits, type Dish } from '../../domain/menus'
import { formatMoney } from '../../domain/money'
import { fillingUp, openState, type Span } from '../../domain/explorer/presentation'
import { eventPhase } from '../../domain/explorer/upcoming'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { StatusBadge } from '../StatusBadge'

/** Open, closed or finished for the chosen day, in words and an icon, never colour alone. */
export function HoursBadge({ hours, day, currentDay, now }: { hours: HoursDay; day: number; currentDay: number; now: string }) {
  const s = openState(hours, day, currentDay, now)
  switch (s.kind) {
    case 'openNow': return <StatusBadge kind="booked" label={t('exp.hours.openNow', { time: formatTime(s.until) })} />
    case 'opensAt': return <StatusBadge kind="ready" label={t('exp.hours.opensAt', { time: formatTime(s.at) })} />
    case 'openAllDay': return <StatusBadge kind="booked" label={t('exp.hours.allDay')} />
    case 'alongside': return <StatusBadge kind="soldOut" label={t('exp.hours.alongside')} />
    case 'closedNow': return <StatusBadge kind="soldOut" label={t('exp.hours.closedNow')} />
    case 'finished': return <StatusBadge kind="soldOut" label={t('exp.hours.finished')} />
    case 'closedDay': return <StatusBadge kind="soldOut" label={t('exp.hours.closedDay')} />
  }
}

const AGE: Record<ExplorerEvent['age'], StringKey | null> = { all: null, kids: 'exp.age.kids', teens: 'exp.age.teens', adults: 'exp.age.adults' }

export interface PlanControl { planned: boolean; busy: boolean; onToggle: () => void }

/** One event as a row: time range, title, detail, cost, age, status badges, and (with `plan`) the toggle that adds it to the guest's plan. */
export function EventRow({ event, now, plan, clash, compact }: { event: ExplorerEvent; now: number; plan?: PlanControl; clash?: readonly Span[]; compact?: boolean }) {
  const phase = eventPhase(event, now)
  const cancelled = event.status === 'cancelled'
  const age = AGE[event.age]
  const full = event.left === 0
  return (
    <li className={`exp-event${cancelled ? ' exp-event--cancelled' : ''}`}>
      <p className="exp-event__time">
        <time>{formatTime(event.start)}</time> {t('exp.event.for', { minutes: event.minutes })}
        {phase === 'now' && !cancelled && <> <StatusBadge kind="booked" label={t('exp.event.now')} /></>}
      </p>
      <p className="exp-event__title"><strong>{cancelled ? <s>{event.title}</s> : event.title}</strong></p>
      {cancelled && <StatusBadge kind="cancelled" label={event.reason ? t('exp.event.cancelledWhy', { reason: event.reason }) : t('exp.event.cancelled')} />}
      {event.status === 'moved' && <StatusBadge kind="changed" label={event.reason ? t('exp.event.movedWhy', { was: formatTime(event.was ?? event.start), reason: event.reason }) : t('exp.event.moved', { was: formatTime(event.was ?? event.start) })} />}
      {!compact && <p>{event.detail}</p>}
      <p className="muted">
        {event.extra > 0 ? t('exp.event.cost', { amount: formatMoney(event.extra) }) : t('exp.event.included')}
        {age && <> · {t(age)}</>}
        {fillingUp(event) && <> · <StatusBadge kind="waitlist" label={t('exp.event.filling', { left: event.left ?? 0 })} /></>}
        {full && <> · <StatusBadge kind="soldOut" label={t('exp.event.full')} /></>}
      </p>
      {clash && clash.length > 0 && !(plan?.planned) && <p className="exp-event__clash" role="note">{t('exp.event.clash', { title: clash[0].title })}</p>}
      {plan && !cancelled && (
        <Button variant={plan.planned ? 'secondary' : 'primary'} aria-pressed={plan.planned} disabled={plan.busy || (full && !plan.planned)} onClick={plan.onToggle}>
          {plan.planned ? t('exp.plan.remove') : t('exp.plan.add')}<span className="visually-hidden"> {event.title}</span>
        </Button>
      )}
    </li>
  )
}

/** A row of kind chips. `all` clears the filter. */
export function FilterChips({ kinds, label, value, onChange, labels }: { kinds: readonly string[]; label: string; value: string | null; onChange: (kind: string | null) => void; labels: Record<string, string> }) {
  if (kinds.length < 2) return null
  return (
    <div role="group" aria-label={label} className="chip-row">
      <Chip pressed={value === null} onToggle={() => onChange(null)}>{t('exp.filter.all')}</Chip>
      {kinds.map((k) => <Chip key={k} pressed={value === k} onToggle={() => onChange(value === k ? null : k)}>{labels[k] ?? k}</Chip>)}
    </div>
  )
}

const MEAL: Record<MealMenu['meal'], StringKey> = { breakfast: 'exp.meal.breakfast', brunch: 'exp.meal.brunch', lunch: 'exp.meal.lunch', tea: 'exp.meal.tea', dinner: 'exp.meal.dinner', allDay: 'exp.meal.allDay' }

/** The menus of a restaurant for the day, with what each dish contains and a switch that keeps only the dishes that suit the guest's diets. */
export function MenuPanel({ menus, diets }: { menus: readonly MealMenu[]; diets: readonly DietaryId[] }) {
  const [onlyMine, setOnlyMine] = useState(true)
  if (menus.length === 0) return null
  const filtering = onlyMine && diets.length > 0
  const suits = (name: string, contains: readonly string[]): boolean => !filtering || diets.every((d) => dishSuits({ name, contains: contains as Dish['contains'] }, d))
  const ask = diets.filter((d) => NEEDS_ASKING.includes(d))
  return (
    <section aria-labelledby="exp-menu-h">
      <h2 id="exp-menu-h">{t('exp.menu.title')}</h2>
      {diets.length > 0 && <div className="chip-row"><Chip pressed={onlyMine} onToggle={() => setOnlyMine(!onlyMine)}>{t('exp.menu.suits')}</Chip></div>}
      {ask.length > 0 && <p className="muted">{t('exp.menu.ask')}</p>}
      {menus.map((m) => (
        <div key={`${m.meal}-${m.from}`} className="card">
          <h3 className="card__title">{m.theme ? `${t(MEAL[m.meal])}: ${m.theme}` : m.title}</h3>
          <p className="muted">{formatTime(m.from)} {t('exp.menu.to')} {formatTime(m.to)}{m.formal && <> · <StatusBadge kind="ready" label={t('exp.menu.formal')} /></>}</p>
          {m.courses.map((c) => {
            const shown = c.dishes.filter((d) => suits(d.name, d.contains))
            if (shown.length === 0) return null
            return (
              <div key={c.name}>
                <h4>{c.name}</h4>
                <ul className="plain-bullets">
                  {shown.map((d) => <li key={d.name}>{d.name}{d.contains.length > 0 && <small className="muted"> ({t('exp.menu.contains', { list: d.contains.join(', ') })})</small>}</li>)}
                </ul>
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}

export interface ReservationItem {
  id: string
  title: string
  /** "Tue 12 Nov, 7:30 PM". */
  when: string
  facts: readonly string[]
  /** Where the venue page is, so the row links to it. */
  to?: string
  /** Labels for a screen reader, which say which reservation the buttons are for. */
  name: string
}

/** The guest's reservations, each with Change and Cancel; nothing about what is being reserved. */
export function ReservationList({ heading, items, empty, onChange, onCancel, action, readOnly }: { heading: string; items: readonly ReservationItem[]; empty: string; onChange: (id: string) => void; onCancel: (id: string) => void; action?: ReactNode; readOnly?: boolean }) {
  return (
    <section aria-labelledby="exp-res-h">
      <h2 id="exp-res-h">{heading}</h2>
      {items.length === 0 ? <p className="muted">{empty}</p> : (
        <ul className="card-grid">
          {items.map((r) => (
            <li key={r.id} className="card">
              <h3 className="card__title">{r.to ? <Link to={r.to}>{r.title}</Link> : r.title}</h3>
              <StatusBadge kind="booked" label={t('exp.res.confirmed')} />
              <p><strong>{r.when}</strong></p>
              {r.facts.length > 0 && <ul className="tour__facts">{r.facts.map((f) => <li key={f}>{f}</li>)}</ul>}
              {!readOnly && (
                <div className="exp-actions">
                  <Button variant="secondary" onClick={() => onChange(r.id)}>{t('exp.res.change')}<span className="visually-hidden"> {r.name}</span></Button>
                  <Button variant="tertiary" onClick={() => onCancel(r.id)}>{t('exp.res.cancel')}<span className="visually-hidden"> {r.name}</span></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {action}
    </section>
  )
}
