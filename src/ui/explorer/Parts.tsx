import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { DishFlag, ExplorerDay, ExplorerEvent, HoursDay, MealMenu } from '../../api/explorerTypes'
import type { DietaryId } from '../../domain/account'
import { formatTime } from '../../domain/cruise'
import { NEEDS_ASKING, dishSuits, type Dish } from '../../domain/menus'
import { formatMoney } from '../../domain/money'
import { fillingUp, mealOver, openState, type Span } from '../../domain/explorer/presentation'
import { avoidedFlags, usedFlags } from '../../domain/explorer/diningDiscovery'
import { happeningNow } from '../../domain/explorer/planTimeline'
import { eventPhase } from '../../domain/explorer/upcoming'
import { t, type StringKey, headingCase } from '../../i18n'
import { MEAL } from './mealStrings'
import { Button, LinkButton } from '../Button'
import { Chip } from '../Chip'
import { ACCESS_FEATURES, type AccessFeature } from '../../domain/eventAccess'
import { EXPLORER_LEADS, REMINDER_DEFAULT } from '../../domain/notifications'
import { StatusBadge } from '../StatusBadge'
import { SendToChat } from '../onboard/SendToChat'
import { TimeOfDayIcon } from '../TimeOfDay'
import { CalendarClock, CalendarPlus, CalendarX, X } from '../icons'
import { DishSaveButton } from './DishSave'
import { AvoidNote, DietLegend, DietMarks, DishFlags, FlagLegend } from './DietMarks'

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

export interface PlanControl {
  planned: boolean
  busy: boolean
  onToggle: () => void
  /** The reminder chosen for this event (minutes, 0 off, `REMINDER_DEFAULT` for the notification preference), and how it is changed. Without these there is no reminder choice. */
  reminder?: number
  onReminder?: (lead: number) => void
}

/** The access codes of an event that the app knows how to say, in the order the app uses. */
const accessOf = (event: Pick<ExplorerEvent, 'access'>): AccessFeature[] => ACCESS_FEATURES.filter((f) => event.access?.includes(f))

/** What to wear, when to arrive and what access there is, for the events that say. */
function EventNotes({ event }: { event: ExplorerEvent }) {
  const access = accessOf(event)
  if (!event.dress && !event.arrive && access.length === 0) return null
  return (
    <ul className="tour__facts">
      {event.dress && <li>{t('exp.event.dress', { text: event.dress })}</li>}
      {event.arrive && <li>{t('exp.event.arrive', { text: event.arrive })}</li>}
      {access.length > 0 && <li><span className="visually-hidden">{t('evAccess.label')}: </span>{access.map((f) => t(`evAccess.${f}` as StringKey)).join(' · ')}</li>}
    </ul>
  )
}

/** One event as a row: time range, title, detail, cost, age, status badges, and (with `plan`) the toggle that adds it to the guest's plan. */
export function EventRow({ event, now, plan, clash, compact, share }: { event: ExplorerEvent; now: number; share?: ReactNode; plan?: PlanControl; clash?: readonly Span[]; compact?: boolean }) {
  const phase = eventPhase(event, now)
  const cancelled = event.status === 'cancelled'
  const age = AGE[event.age]
  const full = event.left === 0
  return (
    <li className={`exp-event${cancelled ? ' exp-event--cancelled' : ''}`}>
      <p className="exp-event__time">
        <TimeOfDayIcon time={event.start} /><time dateTime={event.start}>{formatTime(event.start)}</time> {t('exp.event.for', { minutes: event.minutes })}
        {phase === 'now' && !cancelled && <> <StatusBadge kind="booked" label={t('exp.event.now')} /></>}
      </p>
      <p className="exp-event__title"><strong>{cancelled ? <s>{event.title}</s> : event.title}</strong></p>
      {cancelled && <StatusBadge kind="cancelled" label={event.reason ? t('exp.event.cancelledWhy', { reason: event.reason }) : t('exp.event.cancelled')} />}
      {event.status === 'moved' && <StatusBadge kind="changed" label={event.reason ? t('exp.event.movedWhy', { was: formatTime(event.was ?? event.start), reason: event.reason }) : t('exp.event.moved', { was: formatTime(event.was ?? event.start) })} />}
      {!compact && <p>{event.detail}</p>}
      {event.performer && <p>{t('exp.event.performer', { name: event.performer })}</p>}
      {event.series && <p className="muted">{t('exp.event.series', { name: event.series })}</p>}
      {!compact && <EventNotes event={event} />}
      <p className="muted">
        {event.extra > 0 ? t('exp.event.cost', { amount: formatMoney(event.extra) }) : t('exp.event.included')}
        {age && <> · {t(age)}</>}
        {fillingUp(event) && <> · <StatusBadge kind="waitlist" label={t('exp.event.filling', { left: event.left ?? 0 })} /></>}
        {full && <> · <StatusBadge kind="soldOut" label={t('exp.event.full')} /></>}
      </p>
      {clash && clash.length > 0 && !(plan?.planned) && <p className="exp-event__clash" role="note">{t('exp.event.clash', { title: clash[0].title })}</p>}
      {plan && !cancelled && (
        <Button variant={plan.planned ? 'secondary' : 'primary'} icon={plan.planned ? CalendarX : CalendarPlus} disabled={plan.busy || (full && !plan.planned)} onClick={plan.onToggle}>
          {plan.planned ? t('exp.plan.remove') : t('exp.plan.add')}<span className="visually-hidden"> {event.title}</span>
        </Button>
      )}
      {plan?.planned && !cancelled && plan.onReminder && (
        <div className="field">
          <label htmlFor={`rem-${event.id}`}>{t('exp.remind.label')}<span className="visually-hidden"> {event.title}</span></label>
          <select id={`rem-${event.id}`} className="field__input" value={plan.reminder ?? REMINDER_DEFAULT} disabled={plan.busy} onChange={(e) => plan.onReminder?.(Number(e.target.value))}>
            <option value={REMINDER_DEFAULT}>{t('exp.remind.default')}</option>
            {EXPLORER_LEADS.map((m) => <option key={m} value={m}>{m === 0 ? t('notices.explorerOff') : t('notices.explorerMinutes', { count: m })}</option>)}
          </select>
        </div>
      )}
      {share}
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


/** One meal's menu as a collapsible card. A meal already served starts collapsed; the guest's own choice after that is kept. */
function MealCard({ shipId, venueId, m, over, suits, avoid }: { shipId: string; venueId: string; m: MealMenu; over: boolean; avoid: readonly DishFlag[]; suits: (name: string, contains: readonly string[]) => boolean }) {
  const [open, setOpen] = useState(!over)
  const title = m.theme ? `${t(MEAL[m.meal])}: ${m.theme}` : m.title
  return (
    <details className="card ship-section" data-meal={m.meal} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <h3 className="card__title ship-section__title">{headingCase(title)}</h3>
        {over && <StatusBadge kind="soldOut" label={t('exp.menu.served')} />}
      </summary>
      <p className="muted"><TimeOfDayIcon time={m.from} />{formatTime(m.from)} {t('exp.menu.to')} {formatTime(m.to)}{m.formal && <> · <StatusBadge kind="ready" label={t('exp.menu.formal')} /></>}</p>
      <SendToChat shareRef={`menu:${venueId}:${m.meal}`} title={title} />
      {m.courses.map((c) => {
        const shown = c.dishes.filter((d) => suits(d.name, d.contains))
        if (shown.length === 0) return null
        return (
          <div key={c.name}>
            <h4>{headingCase(c.name)}</h4>
            <ul className="plain-bullets">
              {shown.map((d) => { const asked = avoidedFlags(d.flags, avoid); return <li key={d.name} className={asked.length > 0 ? 'dish--avoid' : undefined}><strong>{d.name}</strong><DietMarks marks={d.marks} /><DishFlags flags={d.flags} /><DishSaveButton shipId={shipId} venueId={venueId} name={d.name} />{d.note ? <span className="dish-desc">{d.note}</span> : <br />}{d.contains.length > 0 && <small className="muted"> ({t('exp.menu.contains', { list: d.contains.join(', ') })})</small>}<AvoidNote flags={asked} /></li> })}
            </ul>
          </div>
        )
      })}
    </details>
  )
}

/** The menus of a restaurant for the day, with what each dish contains and a switch that keeps only the dishes that suit the guest's diets. */
export function MenuPanel({ shipId, venueId, menus, diets, avoid = [], day, currentDay, now }: { shipId: string; venueId: string; menus: readonly MealMenu[]; diets: readonly DietaryId[]; avoid?: readonly DishFlag[]; day: number; currentDay: number; now: string }) {
  const [onlyMine, setOnlyMine] = useState(true)
  if (menus.length === 0) return null
  const filtering = onlyMine && diets.length > 0
  const suits = (name: string, contains: readonly string[]): boolean => !filtering || diets.every((d) => dishSuits({ name, contains: contains as Dish['contains'] }, d))
  const ask = diets.filter((d) => NEEDS_ASKING.includes(d))
  const flagsUsed = usedFlags(menus)
  const hasMarks = menus.some((m) => m.courses.some((c) => c.dishes.some((d) => (d.marks?.length ?? 0) > 0)))
  return (
    <section aria-labelledby="exp-menu-h">
      <h2 id="exp-menu-h">{headingCase(t('exp.menu.title'))}</h2>
      {diets.length > 0 && <div className="chip-row"><Chip pressed={onlyMine} onToggle={() => setOnlyMine(!onlyMine)}>{t('exp.menu.suits')}</Chip></div>}
      {ask.length > 0 && <p className="muted">{t('exp.menu.ask')}</p>}
      {hasMarks && <DietLegend />}
      {flagsUsed.length > 0 && <FlagLegend used={flagsUsed} />}
      {(hasMarks || flagsUsed.length > 0) && <p className="muted">{t('exp.diet.ask')}</p>}
      {menus.map((m) => <MealCard key={`${m.meal}-${m.from}`} shipId={shipId} venueId={venueId} m={m} over={mealOver(m, day, currentDay, now)} suits={suits} avoid={avoid} />)}
    </section>
  )
}

export interface ReservationItem {
  id: string
  title: string
  /** "Tue 12 Nov, 7:30 PM". */
  when: string
  /** The start time "HH:MM", for the part-of-day icon. */
  time?: string
  facts: readonly string[]
  /** Where the venue page is, so the row links to it. */
  to?: string
  /** Labels for a screen reader, which say which reservation the buttons are for. */
  name: string
}

/** The guest's reservations, each with Change and Cancel; nothing about what is being reserved. */
export function ReservationList({ heading, items, empty, onChange, onCancel, action, readOnly, id = 'exp-res-h', level = 2 }: { heading: string; items: readonly ReservationItem[]; empty: string; onChange: (id: string) => void; onCancel: (id: string) => void; action?: ReactNode; readOnly?: boolean; /** Several lists on one page (a day each) need their own heading ids and a lower heading level. */ id?: string; level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3'
  const Title = level === 2 ? 'h3' : 'h4'
  return (
    <section aria-labelledby={id}>
      <Heading id={id}>{level === 2 ? headingCase(heading) : heading}</Heading>
      {items.length === 0 ? <p className="muted">{empty}</p> : (
        <ul className="card-grid">
          {items.map((r) => (
            <li key={r.id} className="card">
              <Title className="card__title">{r.to ? <Link to={r.to}>{r.title}</Link> : r.title}</Title>
              <StatusBadge kind="booked" label={t('exp.res.confirmed')} />
              <p>{r.time && <TimeOfDayIcon time={r.time} />}<strong>{r.when}</strong></p>
              {r.facts.length > 0 && <ul className="tour__facts">{r.facts.map((f) => <li key={f}>{f}</li>)}</ul>}
              {!readOnly && (
                <div className="exp-actions">
                  <Button variant="secondary" icon={CalendarClock} onClick={() => onChange(r.id)}>{t('exp.res.change')}<span className="visually-hidden"> {r.name}</span></Button>
                  <Button variant="secondary" icon={X} onClick={() => onCancel(r.id)}>{t('exp.res.cancel')}<span className="visually-hidden"> {r.name}</span></Button>
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

/** What is on right now across one Explorer, with the time left in each; only on the ship's own day. */
export function HappeningNow({ data, currentDay, now, basePath }: { data: ExplorerDay; currentDay: number; now: number; basePath: string }) {
  if (data.day !== currentDay) return null
  const running = data.venues.flatMap((v) => happeningNow(v.events, now).map((r) => ({ ...r, venue: v.venue }))).sort((a, b) => a.event.startAt - b.event.startAt)
  if (running.length === 0) return null
  return (
    <section aria-labelledby="exp-now-h">
      <h2 id="exp-now-h">{headingCase(t('exp.now.title'))}</h2>
      <ul className="exp-now">
        {running.map((r) => (
          <li key={r.event.id} className="card">
            <Link to={`${basePath}/${r.venue.id}?day=${data.day}`}>{t('exp.now.left', { title: r.event.title, venue: r.venue.title, minutes: r.minutesLeft })}</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Links from an Explorer to pages on board that it does not list: ordering for pickup, gift cards, games and services. */
export function MoreLinks({ links }: { links: readonly { to: string; label: string }[] }) {
  return (
    <section aria-labelledby="exp-more-h">
      <h2 id="exp-more-h">{headingCase(t('exp.more.title'))}</h2>
      <div className="exp-actions">
        {links.map((l) => <LinkButton key={l.to} to={l.to} variant="secondary">{l.label}</LinkButton>)}
      </div>
    </section>
  )
}
