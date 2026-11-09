import { useRef, useState } from 'react'
import { asProgramView } from '../../api/guards'
import { placeById } from '../../domain/deck'
import { arrangeDay, interestsOf, NO_ENTERTAINMENT_FILTER, standings, venuesOf, type EntertainmentFilter, type EntertainmentOrder, type Standing } from '../../domain/entertainment'
import { EVENT_INTERESTS, type DatedEvent, type EventInterest } from '../../domain/program'
import { formatMoney } from '../../domain/money'
import { useCurrentDay } from '../../hooks/useDayPlan'
import { useNow, usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, th, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { StatusBadge } from '../StatusBadge'
import { Saved } from './common'
import { useShipTime } from './shipTime'

/** Entertainment today: the day's programme, latest start first by default, with what is on now and what comes next marked, and a choice of kind and venue. */
export function EntertainmentScreen() {
  const me = usePersona()
  const day = useCurrentDay()
  const copy = useSavedCopy('program', `${me?.id ?? 'none'}:${day}`, () => api.onboard.program(day), asProgramView, [me?.id, day])
  return (
    <div className="page">
      <Saved copy={copy}>{(view) => <Day events={view.events} />}</Saved>
    </div>
  )
}

const where = (e: DatedEvent): string => {
  const p = placeById(e.placeId)
  return p ? t('onb.where', { name: p.name, deck: p.deck }) : ''
}

function Day({ events }: { events: DatedEvent[] }) {
  const now = useNow()
  const shipTime = useShipTime()
  const [filter, setFilter] = useState<EntertainmentFilter>(NO_ENTERTAINMENT_FILTER)
  const [order, setOrder] = useState<EntertainmentOrder>('latest')
  const nextRef = useRef<HTMLLIElement | null>(null)
  const stand = standings(events, now)
  const shown = arrangeDay(events, filter, order)
  const kinds = interestsOf(events, EVENT_INTERESTS)
  const venues = venuesOf(events)
  const next = events.filter((e) => stand.get(e.id) === 'next')
  const live = events.filter((e) => stand.get(e.id) === 'now')
  const firstNext = shown.find((e) => stand.get(e.id) === 'next')
  const toggleKind = (i: EventInterest) => setFilter({ ...filter, interests: filter.interests.includes(i) ? filter.interests.filter((x) => x !== i) : [...filter.interests, i] })
  const filtered = filter.interests.length > 0 || filter.placeId !== null
  return (
    <>
      <Card hero labelledBy="ent-next">
        <h2 id="ent-next" className="card__title">{th('ent.next')}</h2>
        {next.length === 0 ? <p>{t('ent.nextNone')}</p> : (
          <ul className="plain-bullets">{next.map((e) => <li key={e.id}><strong>{shipTime(e.startAt)}</strong> {e.title}, {where(e)}</li>)}</ul>
        )}
        {live.length > 0 && <p className="muted">{t('ent.now')}: {live.map((e) => e.title).join(', ')}</p>}
        {firstNext && <Button variant="secondary" onClick={() => { nextRef.current?.scrollIntoView({ block: 'center' }); nextRef.current?.focus() }}>{t('ent.jump')}</Button>}
      </Card>

      {kinds.length > 1 && (
        <fieldset className="chip-row">
          <legend>{t('ent.kind')}</legend>
          {kinds.map((i) => <Chip key={i} pressed={filter.interests.includes(i)} onToggle={() => toggleKind(i)}>{t(`onb.interest.${i}` as StringKey)}</Chip>)}
        </fieldset>
      )}
      <div className="field">
        <label htmlFor="ent-venue">{t('ent.venue')}</label>
        <select id="ent-venue" className="field__input" value={filter.placeId ?? ''} onChange={(e) => setFilter({ ...filter, placeId: e.target.value || null })}>
          <option value="">{t('ent.venue.all')}</option>
          {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ent-order">{t('ent.order')}</label>
        <select id="ent-order" className="field__input" value={order} onChange={(e) => setOrder(e.target.value as EntertainmentOrder)}>
          <option value="latest">{t('ent.order.latest')}</option>
          <option value="earliest">{t('ent.order.earliest')}</option>
        </select>
      </div>
      {filtered && <p><Button variant="secondary" onClick={() => setFilter(NO_ENTERTAINMENT_FILTER)}>{t('ent.reset')}</Button></p>}

      <p role="status" className="muted">{t('ent.count', { count: shown.length })}</p>
      {events.length === 0 ? <p>{t('ent.empty')}</p> : shown.length === 0 ? <p>{t('ent.none')}</p> : (
        <ul className="event-list">
          {shown.map((e) => <Item key={e.id} e={e} standing={stand.get(e.id) ?? 'later'} liRef={e === firstNext ? nextRef : undefined} />)}
        </ul>
      )}
    </>
  )
}

function Item({ e, standing, liRef }: { e: DatedEvent; standing: Standing; liRef?: React.Ref<HTMLLIElement> }) {
  const shipTime = useShipTime()
  const cancelled = e.status === 'cancelled'
  const cls = ['event', `event--${standing}`, cancelled ? 'event--cancelled' : ''].filter(Boolean).join(' ')
  return (
    <li ref={liRef} tabIndex={liRef ? -1 : undefined} className={cls} data-standing={standing}>
      <p className="event__time">
        <strong>{shipTime(e.startAt)}</strong> <span className="muted">{t('onb.until', { time: shipTime(e.endAt) })}</span>
        {standing === 'next' && <> <StatusBadge kind="ready" label={t('ent.next')} /></>}
        {standing === 'now' && <> <StatusBadge kind="booked" label={t('ent.now')} /></>}
        {standing === 'over' && !cancelled && <> <span className="muted">{t('ent.over')}</span></>}
      </p>
      <h3 className="event__title">{e.title}</h3>
      <p className="event__where">{where(e)} · {t(`onb.interest.${e.interest}` as StringKey)}</p>
      <p className="event__tags">
        {e.status === 'moved' && <StatusBadge kind="changed" label={t('onb.moved', { time: shipTime(e.startAt) })} />}
        {cancelled && <StatusBadge kind="cancelled" label={t('onb.cancelled')} />}
        {e.extra > 0 ? <span className="tag">{t('onb.extra', { price: formatMoney(e.extra) })}</span> : <span className="tag">{t('onb.included')}</span>}
        {e.age !== 'all' && <span className="tag">{t(`onb.age.${e.age}` as StringKey)}</span>}
      </p>
    </li>
  )
}
