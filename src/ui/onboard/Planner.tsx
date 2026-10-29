import { useState } from 'react'
import { asProgramView } from '../../api/guards'
import type { OnboardToday, ProgramView } from '../../api/types'
import { placeById } from '../../domain/deck'
import { formatDate } from '../../domain/cruise'
import { AGE_GROUPS, EVENT_INTERESTS, filterEvents, NO_EVENT_FILTER, nowAndNext, overlapping, REMINDER_MINUTES, sortEvents, type AgeGroup, type DatedEvent, type EventFilter, type EventInterest, type EventSort } from '../../domain/program'
import { formatMoney } from '../../domain/pricing'
import { PORTS } from '../../domain/sailings'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useNow, usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { StatusBadge } from '../StatusBadge'
import { ActionError } from '../account/parts'
import { Saved } from './common'
import { MyTickets, SeatControl, type SeatsInfo } from './Tickets'
import { useAsync } from '../../hooks/useAsync'
import { useShipTime } from './shipTime'

/** The daily planner on board (OB-02, OB-09): the ship's schedule and the guest's own plan in one list, with filters, sorting, "happening now" and "next up". */
export function Planner({ today }: { today: OnboardToday }) {
  const me = usePersona()
  const [day, setDay] = useState(today.day ?? 1)
  const [filter, setFilter] = useState<EventFilter>(NO_EVENT_FILTER)
  const [mineOnly, setMineOnly] = useState(false)
  const [sort, setSort] = useState<EventSort>('time')
  const copy = useSavedCopy('program', `${me?.id ?? 'none'}:${day}`, () => api.onboard.program(day), asProgramView, [me?.id, day])
  return (
    <section aria-labelledby="planner-h">
      <h2 id="planner-h">{t('onb.planner')}</h2>
      <div className="field">
        <label htmlFor="planner-day">{t('onb.planner.day')}</label>
        <select id="planner-day" className="field__input" value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{t('plan.day', { n })}{n === today.day ? ` (${t('onb.planner.today')})` : ''}</option>)}
        </select>
      </div>
      <Saved copy={copy}>
        {(p) => <Day view={p} filter={filter} setFilter={setFilter} mineOnly={mineOnly} setMineOnly={setMineOnly} sort={sort} setSort={setSort} reload={copy.retry} />}
      </Saved>
    </section>
  )
}

interface DayProps {
  view: ProgramView
  filter: EventFilter
  setFilter: (f: EventFilter) => void
  mineOnly: boolean
  setMineOnly: (v: boolean) => void
  sort: EventSort
  setSort: (s: EventSort) => void
  reload: () => void
}

function Day({ view, filter, setFilter, mineOnly, setMineOnly, sort, setSort, reload }: DayProps) {
  const now = useNow()
  const toggle = useAction(async (id: string, on: boolean) => { await api.onboard.togglePlan(id, on); reload() })
  const seats = useAsync(() => api.shows.day(view.day), [view.day])
  const tickets = useAsync(() => api.shows.mine(), [view.day])
  const party = useAsync(() => api.account.party(), [view.day])
  const info: SeatsInfo | null = seats.data && tickets.data && party.data ? { seats: seats.data, tickets: tickets.data, party: party.data, reload: () => { seats.retry(); tickets.retry() } } : null
  const nn = nowAndNext(view.events, now)
  const shown = sortEvents(filterEvents(view.events, filter, now).filter((e) => !mineOnly || view.mine.includes(e.id)), sort)
  const mine = view.events.filter((e) => view.mine.includes(e.id))
  const clashes = overlapping(mine)
  const changed = view.events.filter((e) => e.status !== 'on')
  const flip = <K extends keyof EventFilter>(key: K, value: EventFilter[K]) => setFilter({ ...filter, [key]: filter[key] === value ? NO_EVENT_FILTER[key] : value })
  const toggleInterest = (i: EventInterest) => setFilter({ ...filter, interests: filter.interests.includes(i) ? filter.interests.filter((x) => x !== i) : [...filter.interests, i] })
  return (
    <>
      <p className="muted">{t('onb.planner.for', { date: formatDate(view.date), place: view.port === 'sea' ? t('onb.atSea') : PORTS[view.port].name })}</p>

      {changed.length > 0 && (
        <Banner kind="warning" title={t('onb.changed')}>
          <ul className="plain-bullets">{changed.map((e) => <li key={e.id}><strong>{e.title}</strong>: {e.reason}</li>)}</ul>
        </Banner>
      )}

      {(nn.now.length > 0 || nn.next.length > 0) && (
        <Card labelledBy="now-next-h">
          <h3 id="now-next-h" className="card__title">{t('onb.nowNext')}</h3>
          <ul className="plain-bullets">
            {nn.now.map((e) => <li key={e.id}><strong>{t('onb.happening')}</strong> {e.title}, {place(e)}</li>)}
            {nn.next.map((e) => <li key={e.id}><strong>{t('onb.nextUp')}</strong> <Time at={e.startAt} /> {e.title}, {place(e)}</li>)}
          </ul>
        </Card>
      )}

      <fieldset className="chip-row">
        <legend>{t('onb.filter')}</legend>
        {EVENT_INTERESTS.map((i) => <Chip key={i} pressed={filter.interests.includes(i)} onToggle={() => toggleInterest(i)}>{t(`onb.interest.${i}` as StringKey)}</Chip>)}
      </fieldset>
      <fieldset className="chip-row">
        <legend>{t('onb.filter.who')}</legend>
        {AGE_GROUPS.filter((a): a is Exclude<AgeGroup, 'all'> => a !== 'all').map((a) => <Chip key={a} pressed={filter.age === a} onToggle={() => flip('age', a)}>{t(`onb.age.${a}` as StringKey)}</Chip>)}
        <Chip pressed={filter.stepFree} onToggle={() => setFilter({ ...filter, stepFree: !filter.stepFree })}>{t('onb.filter.stepFree')}</Chip>
        <Chip pressed={filter.cost === 'included'} onToggle={() => flip('cost', 'included')}>{t('onb.filter.included')}</Chip>
        <Chip pressed={filter.cost === 'extra'} onToggle={() => flip('cost', 'extra')}>{t('onb.filter.extra')}</Chip>
        <Chip pressed={filter.upcomingOnly} onToggle={() => setFilter({ ...filter, upcomingOnly: !filter.upcomingOnly })}>{t('onb.filter.upcoming')}</Chip>
        <Chip pressed={mineOnly} onToggle={() => setMineOnly(!mineOnly)}>{t('onb.filter.mine')}</Chip>
      </fieldset>
      <div className="field">
        <label htmlFor="planner-sort">{t('onb.sort')}</label>
        <select id="planner-sort" className="field__input" value={sort} onChange={(e) => setSort(e.target.value as EventSort)}>
          {(['time', 'venue', 'deck'] as const).map((s) => <option key={s} value={s}>{t(`onb.sort.${s}` as StringKey)}</option>)}
        </select>
      </div>

      {clashes.length > 0 && (
        <Banner kind="warning" title={t('onb.clash')}>
          <ul className="plain-bullets">{clashes.map(([a, b]) => <li key={a.id + b.id}>{t('onb.clashPair', { a: a.title, b: b.title })}</li>)}</ul>
        </Banner>
      )}
      {!view.canEdit && <p className="muted">{t('onb.readOnly')}</p>}
      <ActionError error={toggle.error} />
      {info && <MyTickets tickets={info.tickets} />}
      <p role="status" className="muted">{t('onb.count', { count: shown.length })}</p>
      {shown.length === 0 ? <p>{t('onb.none')}</p> : (
        <ul className="event-list">
          {shown.map((e) => <Event key={e.id} e={e} inPlan={view.mine.includes(e.id)} canEdit={view.canEdit} busy={toggle.busy} info={info} onToggle={() => void toggle.run(e.id, !view.mine.includes(e.id))} />)}
        </ul>
      )}
    </>
  )
}

const place = (e: DatedEvent): string => {
  const p = placeById(e.placeId)
  return p ? t('onb.where', { name: p.name, deck: p.deck }) : ''
}

function Time({ at }: { at: number }) {
  const shipTime = useShipTime()
  return <strong>{shipTime(at)}</strong>
}

function Event({ e, inPlan, canEdit, busy, info, onToggle }: { e: DatedEvent; inPlan: boolean; canEdit: boolean; busy: boolean; info: SeatsInfo | null; onToggle: () => void }) {
  const shipTime = useShipTime()
  const p = placeById(e.placeId)
  const cancelled = e.status === 'cancelled'
  return (
    <li className={['event', cancelled ? 'event--cancelled' : ''].filter(Boolean).join(' ')}>
      <p className="event__time"><strong>{shipTime(e.startAt)}</strong> <span className="muted">{t('onb.until', { time: shipTime(e.endAt) })}</span></p>
      <h3 className="event__title">{e.title}</h3>
      <p className="event__where">{place(e)}</p>
      <p className="event__tags">
        {e.status === 'moved' && <StatusBadge kind="changed" label={t('onb.moved', { time: shipTime(e.startAt) })} />}
        {cancelled && <StatusBadge kind="cancelled" label={t('onb.cancelled')} />}
        {inPlan && <StatusBadge kind="booked" label={t('onb.inMyPlan')} />}
        {e.extra > 0 ? <span className="tag">{t('onb.extra', { price: formatMoney(e.extra) })}</span> : <span className="tag">{t('onb.included')}</span>}
        {e.age !== 'all' && <span className="tag">{t(`onb.age.${e.age}` as StringKey)}</span>}
        {p && !p.stepFree && <span className="tag">{t('onb.notStepFree')}</span>}
        {p?.note && <span className="muted">{p.note}</span>}
      </p>
      {info && <SeatControl e={e} info={info} canEdit={canEdit} />}
      {canEdit && !cancelled && (
        <>
          <Button variant="secondary" aria-pressed={inPlan} disabled={busy} onClick={onToggle}>
            {t('onb.add')}<span className="visually-hidden"> {e.title}</span>
          </Button>
          {inPlan && <p className="muted">{t('onb.reminder', { minutes: REMINDER_MINUTES })}</p>}
        </>
      )}
    </li>
  )
}
