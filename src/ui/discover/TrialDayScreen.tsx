import { useEffect, useState } from 'react'
import { formatTime } from '../../domain/cruise'
import { NO_WISH, type DayWish, type Mobility } from '../../domain/day'
import { INTERESTS, type Interest } from '../../domain/excursions'
import { EVENT_INTERESTS, type EventInterest } from '../../domain/program'
import { wishKey } from '../../feeds/dayPlan'
import { hasTours, trialDayFeed } from '../../feeds/trialDay'
import { useFeed } from '../../hooks/useServedFeeds'
import { t, th, type StringKey } from '../../i18n'
import { applyPageMeta } from '../../seo'
import { LinkButton } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { FeedWaiting } from '../FeedWaiting'

const MOBILITY: readonly Mobility[] = ['any', 'easy', 'wheelchair']
const toggle = <T,>(list: readonly T[], x: T): T[] => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

/**
 * A day on this ship (N6.1): someone who has not signed in picks a day and what they enjoy and sees how a day could go. The server builds it from the ship's
 * own programme and keeps nothing; no account, no saved choice, and nothing is booked. It sits outside the shell like the family page, since a visitor has no
 * account, sailings or tabs yet.
 */
export function TrialDayScreen() {
  const [day, setDay] = useState(3)
  const [wish, setWish] = useState<DayWish>(NO_WISH)
  const trial = useFeed(trialDayFeed, day, wishKey(wish))
  const choice = trial?.days.find((d) => d.day === day)
  useEffect(() => {
    applyPageMeta(document, { title: `${t('route.trialDay')} · ${t('app.name')}`, description: t('seo.trialDay'), indexable: true, url: `${window.location.origin}/trial-day` })
  }, [])
  const plan = trial?.plan
  return (
    <>
      <a className="skip-link" href="#main">{t('shell.skip')}</a>
      <main id="main" className="page" tabIndex={-1}>
        <h1>{th('route.trialDay')}</h1>
        <p>{t('trial.intro')}</p>
        <Card labelledBy="trial-pick-h">
          <h2 id="trial-pick-h" className="card__title">{th('day.pick')}</h2>
          <div className="field">
            <label htmlFor="trial-day">{t('day.which')}</label>
            <select id="trial-day" className="field__input" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {(trial?.days ?? [{ day, port: '', place: '' }]).map((d) => <option key={d.day} value={d.day}>{d.place ? t('trial.option', { day: d.day, place: d.place }) : t('trial.optionLoading', { day: d.day })}</option>)}
            </select>
          </div>
          {hasTours(choice, trial?.days) && (
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
            {MOBILITY.map((m) => <label key={m} className="choice"><input type="radio" name="trial-mobility" checked={wish.mobility === m} onChange={() => setWish({ ...wish, mobility: m })} /><span>{t(`day.mobility.${m}` as StringKey)}</span></label>)}
          </fieldset>
          <label className="choice"><input type="checkbox" checked={wish.withKids} onChange={(e) => setWish({ ...wish, withKids: e.target.checked })} /><span>{t('day.kids')}</span></label>
        </Card>

        <Card hero labelledBy="trial-plan-h">
          <h2 id="trial-plan-h" className="card__title">{choice ? th('trial.yours', { day, place: choice.place }) : th('day.yours', { day })}</h2>
          {!plan && <FeedWaiting />}
          {plan?.empty && <p role="status">{t('day.empty')}</p>}
          <ol className="build-list">
            {plan?.items.map((i) => (
              <li key={`${i.kind}-${i.id}`}>
                <p className="build-list__time">{formatTime(i.start)}</p>
                <div>
                  <p><strong>{i.title}</strong> <span className="muted">· {t(`day.kind.${i.kind}` as StringKey)}</span></p>
                  <p className="muted">{i.why}</p>
                </div>
              </li>
            ))}
          </ol>
          {plan?.backBy && <p>{t('day.backBy', { time: formatTime(plan.backBy) })}</p>}
          <p className="muted">{t('trial.note')}</p>
          <LinkButton to="/" variant="secondary">{t('trial.signIn')}</LinkButton>
        </Card>
      </main>
    </>
  )
}
