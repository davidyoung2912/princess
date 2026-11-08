import { useEffect, useState } from 'react'
import { setWatched } from '../../push/browser'
import { Link } from 'react-router'
import { NO_WISH, type DayWish, type Mobility } from '../../domain/day'
import { dayPlanFeed, wishKey } from '../../feeds/dayPlan'
import { useFeed } from '../../hooks/useServedFeeds'
import { FeedWaiting } from '../FeedWaiting'
import { INTERESTS, type Interest } from '../../domain/excursions'
import { formatDayMonth, formatTime } from '../../domain/cruise'
import { EVENT_INTERESTS, type EventInterest } from '../../domain/program'
import { itinerary } from '../../domain/sailings'
import { usePersona, useSailing } from '../../hooks/useDemo'

import { t, th, type StringKey } from '../../i18n'
import { LinkButton } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { BackLink } from '../onboard/common'
import { partyPeople } from '../../account/context'
import { StanleyEmpty } from './StanleyEmpty'

const MOBILITY: readonly Mobility[] = ['any', 'easy', 'wheelchair']
const toggle = <T,>(list: readonly T[], x: T): T[] => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

/** Build my day (PRE-12): pick a day, say what you like and how you get around, and get a day that fits the ship's hours. Nothing is booked from here. */
export function DayScreen() {
  const sailing = useSailing()
  const me = usePersona()
  const days = itinerary(sailing)
  const [day, setDay] = useState(3)
  const [wish, setWish] = useState<DayWish>({ ...NO_WISH, withKids: !!me && partyPeople(me.id).some((p) => p.age < 13) })
  const plan = useFeed(dayPlanFeed, sailing.id, day, wishKey(wish))
  // The events in the day shown are the ones to hear about if the ship moves or cancels them (N3.3).
  const followed = plan?.items.filter((i) => i.kind === 'event').map((i) => i.id).join(' ') ?? ''
  useEffect(() => { setWatched(followed.split(' ').filter(Boolean)) }, [followed])
  return (
    <div className="page">
      <p>{t('day.intro')}</p>
      <Card labelledBy="day-pick-h">
        <h2 id="day-pick-h" className="card__title">{th('day.pick')}</h2>
        <div className="field">
          <label htmlFor="day-select">{t('day.which')}</label>
          <select id="day-select" className="field__input" value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {days.map((d) => <option key={d.day} value={d.day}>{t('day.option', { day: d.day, date: formatDayMonth(d.date), place: t(`day.place.${d.port}` as StringKey) })}</option>)}
          </select>
        </div>
        {day >= 3 && day <= 5 && (
          <fieldset className="chip-group">
            <legend>{t('day.tours')}</legend>
            {INTERESTS.map((i: Interest) => <Chip key={i} pressed={wish.tours.includes(i)} onToggle={() => setWish({ ...wish, tours: toggle(wish.tours, i) })}>{t(`exc.interest.${i}` as StringKey)}</Chip>)}
          </fieldset>
        )}
        <fieldset className="chip-group">
          <legend>{t('day.events')}</legend>
          {EVENT_INTERESTS.map((i: EventInterest) => <Chip key={i} pressed={wish.events.includes(i)} onToggle={() => setWish({ ...wish, events: toggle(wish.events, i) })}>{t(`onb.interest.${i}` as StringKey)}</Chip>)}
        </fieldset>
        <fieldset className="rate">
          <legend>{t('day.mobility')}</legend>
          {MOBILITY.map((m) => <label key={m} className="choice"><input type="radio" name="day-mobility" checked={wish.mobility === m} onChange={() => setWish({ ...wish, mobility: m })} /><span>{t(`day.mobility.${m}` as StringKey)}</span></label>)}
        </fieldset>
        <label className="choice"><input type="checkbox" checked={wish.withKids} onChange={(e) => setWish({ ...wish, withKids: e.target.checked })} /><span>{t('day.kids')}</span></label>
      </Card>
      <Card hero labelledBy="day-plan-h">
        <h2 id="day-plan-h" className="card__title">{th('day.yours', { day })}</h2>
        {!plan && <FeedWaiting />}
        {plan?.empty && <StanleyEmpty pose="map">{t('day.empty')}</StanleyEmpty>}
        <ol className="build-list">
          {plan?.items.map((i) => (
            <li key={`${i.kind}-${i.id}`}>
              <p className="build-list__time">{formatTime(i.start)}</p>
              <div>
                <p><strong>{i.title}</strong> <span className="muted">· {t(`day.kind.${i.kind}` as StringKey)}</span></p>
                <p className="muted">{i.why} · <Link to={i.path}>{t(`day.see.${i.kind}` as StringKey)}</Link></p>
              </div>
            </li>
          ))}
        </ol>
        {plan?.backBy && <p>{t('day.backBy', { time: formatTime(plan.backBy) })}</p>}
        <p className="muted">{t('day.note')}</p>
        <LinkButton to="/home/concierge" variant="secondary">{t('day.askConcierge')}</LinkButton>
      </Card>
      <BackLink to="/plan" label={t('route.plan')} />
    </div>
  )
}
