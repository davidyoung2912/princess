import { Link } from 'react-router'
import { downloadText } from '../delights/cardTools'
import { formatTime } from '../../domain/cruise'
import { EXPLORER_PATHS, planCalendar } from '../../domain/explorer/planItems'
import { alternativesFor, needsAlternatives, type Alternative } from '../../domain/explorer/alternatives'
import { clashMap, disrupted, groupByPeriod, walkHints, type Period, type PlanItem, type WalkHint } from '../../domain/explorer/planTimeline'
import { PORTS, shipZoneAt, shipZoneOnDate } from '../../domain/sailings'
import { timeIn } from '../../domain/timezones'
import { useExplorerDay } from '../../hooks/useExplorer'
import { useSailing } from '../../hooks/useDemo'
import { StanleyPose } from '../StanleyPose'
import { useTodayPlan } from '../../hooks/useTodayPlan'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { ChosenDayNote, PickDateButton } from '../explorer/DateControls'
import { ShipClockCard } from '../explorer/ShipClockCard'
import { LoadError } from '../discover/parts'

const PERIOD: Record<Period, StringKey> = { morning: 'plan.today.morning', afternoon: 'plan.today.afternoon', evening: 'plan.today.evening' }
const KIND: Record<PlanItem['kind'], StringKey> = { event: 'plan.today.kind.event', dining: 'plan.today.kind.dining', spa: 'plan.today.kind.spa', tour: 'plan.today.kind.tour' }
const LINKS = [
  ['route.diningToday', EXPLORER_PATHS.dining], ['route.entertainment', EXPLORER_PATHS.entertainment], ['route.shoppingToday', EXPLORER_PATHS.shopping],
  ['route.spaExplorer', EXPLORER_PATHS.spa], ['route.exerciseExplorer', EXPLORER_PATHS.exercise], ['route.activitiesExplorer', EXPLORER_PATHS.activities],
] as const

/** Today's plan, the seventh page of the Explorer family: the ship's clock and date, then everything the guest has on that day in time order. */
export function TodayPlanScreen() {
  const state = useExplorerDay()
  const sailing = useSailing()
  const plan = useTodayPlan(state.day)
  const groups = groupByPeriod(plan.items)
  const clashes = clashMap(plan.items)
  const hints = walkHints(plan.items)
  const changed = disrupted(plan.items)
  const choice = state.choices[state.day - 1]
  const portName = choice && !choice.atSea ? PORTS[choice.port]?.name ?? choice.port : ''
  const clockAt = (epoch: number) => formatTime(timeIn(epoch, shipZoneAt(sailing, epoch)))
  const addToCalendar = () => {
    if (!plan.date) return
    downloadText(`plan-day-${state.day}.ics`, 'text/calendar', planCalendar(plan.items, { date: plan.date, zone: shipZoneOnDate(sailing, plan.date), stamp: state.nowAt, product: 'princess.concept', where: t('plan.today.calendarWhere') }))
  }
  return (
    <div className="page">
      <Card hero labelledBy="tp-head">
        <span className="landing-pose calm-hide"><StanleyPose head="scheduler" size={88} /></span>
        <h2 id="tp-head" className="card__title">{t('route.todayPlan')}</h2>
        <p>{t('plan.today.purpose')}</p>
        {portName && <p><Link to={`/home/ports/${choice.port}`}>{t('port.guide', { port: portName })}</Link></p>}
      </Card>
      <ShipClockCard state={state} />
      <PickDateButton state={state} />
      <ChosenDayNote state={state} />
      {changed.length > 0 && (
        <Banner kind="warning" title={t('plan.today.changed')}>
          <ul className="plain-bullets">
            {changed.map((i) => <li key={i.id}>{changeText(i)}</li>)}
          </ul>
        </Banner>
      )}
      {!plan.ready ? <p role="status" className="muted">{t('account.loading')}</p> : plan.failed && plan.items.length === 0 ? <LoadError retry={plan.retry} /> : (
        <>
          {plan.failed && <Banner kind="info" title={t('plan.today.partial')} action={<Button variant="secondary" onClick={plan.retry}>{t('plan.today.retry')}</Button>}><p>{t('plan.today.partialBody')}</p></Banner>}
          {groups.length === 0 ? <p className="muted">{t('plan.today.empty')}</p> : groups.map((g) => (
            <section key={g.period} aria-labelledby={`tp-${g.period}`}>
              <h2 id={`tp-${g.period}`}>{t(PERIOD[g.period])}</h2>
              <ul className="exp-events">
                {g.items.map((i) => <PlanRow key={`${i.kind}-${i.id}`} item={i} day={state.day} clash={clashes.get(i.id)} hint={hints.get(i.id)} clockAt={clockAt} alternatives={needsAlternatives(i, clashes) ? alternativesFor(i, plan.explorers, plan.items, state.nowAt) : []} />)}
              </ul>
            </section>
          ))}
          {plan.items.some((i) => i.status !== 'cancelled') && <p><Button variant="secondary" onClick={addToCalendar}>{t('plan.today.calendar')}</Button></p>}
        </>
      )}
      <section aria-labelledby="tp-add">
        <h2 id="tp-add">{t('plan.today.add')}</h2>
        <ul className="plain-bullets">{LINKS.map(([key, to]) => <li key={to}><Link to={`${to}?day=${state.day}`}>{t(key)}</Link></li>)}</ul>
      </section>
    </div>
  )
}

function changeText(i: PlanItem): string {
  const was = formatTime(i.was ?? i.start)
  if (i.status === 'cancelled') return i.reason ? t('plan.today.cancelledWhy', { title: i.title, reason: i.reason }) : t('plan.today.cancelled', { title: i.title })
  return i.reason ? t('plan.today.movedWhy', { title: i.title, was, time: formatTime(i.start), reason: i.reason }) : t('plan.today.moved', { title: i.title, was, time: formatTime(i.start) })
}

function PlanRow({ item, day, clash, hint, clockAt, alternatives }: { item: PlanItem; day: number; clash?: PlanItem[]; hint?: WalkHint; clockAt: (epoch: number) => string; alternatives: Alternative[] }) {
  const cancelled = item.status === 'cancelled'
  return (
    <li className={`exp-event${cancelled ? ' exp-event--cancelled' : ''}`}>
      {hint && <p className="muted" role="note">{t(hint.tight ? 'plan.today.walkTight' : 'plan.today.walk', { minutes: hint.minutes, place: hint.from.venueTitle, time: clockAt(hint.leaveBy) })}</p>}
      <p className="exp-event__time"><time>{formatTime(item.start)}</time> {t('plan.today.until', { time: clockAt(item.endAt) })}</p>
      <p className="exp-event__title"><strong>{cancelled ? <s>{item.title}</s> : item.title}</strong></p>
      {cancelled && <StatusBadge kind="cancelled" label={t('exp.event.cancelled')} />}
      {item.status === 'moved' && <StatusBadge kind="changed" label={t('exp.event.moved', { was: formatTime(item.was ?? item.start) })} />}
      <p className="muted">{t(KIND[item.kind])}{item.venueTitle && item.venueTitle !== item.title && <> · <Link to={item.link ?? `${EXPLORER_PATHS[item.explorer]}/${item.venueId}?day=${day}`}>{item.venueTitle}</Link></>}</p>
      {clash && clash.length > 0 && <p className="exp-event__clash" role="note">{t('exp.event.clash', { title: clash[0].title })}</p>}
      {alternatives.length > 0 && (
        <div role="group" aria-label={t('plan.alt.title')}>
          <p className="muted">{t(item.status === 'cancelled' ? 'plan.alt.cancelled' : item.status === 'moved' ? 'plan.alt.moved' : 'plan.alt.clash')}</p>
          <ul className="plain-bullets">
            {alternatives.map((a) => (
              <li key={a.id}><Link to={`${EXPLORER_PATHS[a.explorer]}/${a.venueId}?day=${day}`}>{a.start ? t('plan.alt.event', { title: a.title, time: formatTime(a.start), venue: a.venueTitle }) : t('plan.alt.place', { title: a.title })}</Link></li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}
