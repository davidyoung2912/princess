import { PathLinkList } from '../ScreenList'
import { PillIcon } from '../PillIcon'
import { useState } from 'react'
import { Link } from 'react-router'
import { downloadText } from '../delights/cardTools'
import { formatTime } from '../../domain/cruise'
import { EXPLORER_PATHS, planCalendar } from '../../domain/explorer/planItems'
import { alternativesFor, needsAlternatives, type Alternative } from '../../domain/explorer/alternatives'
import { clashMap, disrupted, groupByPeriod, walkHints, type Period, type PlanItem, type WalkHint } from '../../domain/explorer/planTimeline'
import { itinerary, shipZoneAt, shipZoneOnDate } from '../../domain/sailings'
import { timeIn } from '../../domain/timezones'
import { useExplorerDay } from '../../hooks/useExplorer'
import { useSailing } from '../../hooks/useDemo'
import { dayBundles } from '../../domain/explorer/evening'
import { useAddToPlan } from '../../hooks/useAddToPlan'
import { useTaste } from '../../hooks/useTaste'
import { useVenuePins } from '../../hooks/useVenuePins'
import { DayBundles } from './DayBundles'
import { StanleyPose } from '../StanleyPose'
import { dishesAt } from '../../domain/explorer/shortlist'
import { useSavedDishes } from '../../hooks/useSavedDishes'
import { useTodayPlan } from '../../hooks/useTodayPlan'
import { t, type StringKey, headingCase } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { ExplorerIcon } from '../explorer/ExplorerIcon'
import { Bookmark, MapPin } from '../icons'
import { TimeOfDayIcon } from '../TimeOfDay'
import { Plus } from 'lucide-react'
import { InviteDialog } from './InviteDialog'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { PickDateButton } from '../explorer/DateControls'
import { ItineraryDayInfo } from './ItineraryScreen'
import { LoadError } from '../discover/parts'

const PERIOD: Record<Period, StringKey> = { morning: 'plan.today.morning', afternoon: 'plan.today.afternoon', evening: 'plan.today.evening' }
const LINKS = [
  ['route.diningToday', EXPLORER_PATHS.dining], ['route.entertainment', EXPLORER_PATHS.entertainment], ['route.shoppingToday', EXPLORER_PATHS.shopping],
  ['route.excursionsExplorer', '/excursions-explorer'], ['route.spaExplorer', EXPLORER_PATHS.spa], ['route.exerciseExplorer', EXPLORER_PATHS.exercise], ['route.activitiesExplorer', EXPLORER_PATHS.activities],
] as const

/** Today's plan, the seventh page of the Explorer family: the ship's clock and date, then everything the guest has on that day in time order. */
export function TodayPlanScreen() { return <PlanDay /> }

/** One trip day at a glance, reached from the trip itinerary (`?day=`): the same schedule as Today's plan, for the day chosen. */
export function DayDetailsScreen() { return <PlanDay details /> }

function PlanDay({ details = false }: { details?: boolean }) {
  const state = useExplorerDay()
  const sailing = useSailing()
  const plan = useTodayPlan(state.day)
  const groups = groupByPeriod(plan.items)
  const clashes = clashMap(plan.items)
  const hints = walkHints(plan.items)
  const changed = disrupted(plan.items)
  const addToPlan = useAddToPlan(state.day, plan.retry)
  const { profile: taste } = useTaste()
  const pins = useVenuePins(plan.explorers.flatMap((d) => d.venues.map((v) => v.venue)))
  const pinnedVenueIds = plan.explorers.flatMap((d) => d.venues.filter((v) => pins.isPinned(v.venue)).map((v) => v.venue.id))
  const bundles = plan.ready ? dayBundles(plan.explorers, plan.items, taste, { now: state.nowAt, pinnedVenueIds }) : []
  const savedDishes = useSavedDishes()
  const clockAt = (epoch: number) => formatTime(timeIn(epoch, shipZoneAt(sailing, epoch)))
  const addToCalendar = () => {
    if (!plan.date) return
    downloadText(`plan-day-${state.day}.ics`, 'text/calendar', planCalendar(plan.items, { date: plan.date, zone: shipZoneOnDate(sailing, plan.date), stamp: state.nowAt, product: 'princess.concept', where: t('plan.today.calendarWhere') }))
  }
  const days = itinerary(sailing)
  const itineraryDay = days[state.day - 1]
  // Today's Plan shows the Day Plan card (date, place and what the page lists) when another day than today is chosen.
  const dayCard = details || state.day !== state.currentDay
  return (
    <div className="page">
      <Card hero labelledBy="tp-head" tour="plan-card">
        <span className="landing-pose calm-hide"><StanleyPose head="scheduler" size={88} /></span>
        <div className="tp-title-row"><h2 id="tp-head" className="card__title">{headingCase(t(dayCard ? 'route.dayDetails' : 'route.todayPlan'))}</h2>{state.day === state.currentDay && <StatusBadge kind="booked" label={t('itin.today')} />}</div>
        {itineraryDay && <ItineraryDayInfo d={itineraryDay} last={state.day === days.length} today={state.day === state.currentDay} badge={false} />}
      </Card>
      <PickDateButton state={state} />
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
          {groups.length === 0 ? <p className="muted">{t('plan.today.empty')}</p> : groups.map((g, gi) => (
            <section key={g.period} aria-labelledby={`tp-${g.period}`} data-tour={gi === 0 ? 'plan-first' : undefined}>
              <h2 id={`tp-${g.period}`}>{headingCase(t(PERIOD[g.period]))}</h2>
              <ul className="event-list">
                {g.items.map((i) => <PlanRow key={`${i.kind}-${i.id}`} item={i} day={state.day} clash={clashes.get(i.id)} hint={hints.get(i.id)} clockAt={clockAt} dishes={dishesOnLine(i, savedDishes)} alternatives={needsAlternatives(i, clashes) ? alternativesFor(i, plan.explorers, plan.items, state.nowAt) : []} onAdd={addToPlan.add} onRemove={addToPlan.remove} busy={addToPlan.busy} />)}
              </ul>
            </section>
          ))}
          <DayBundles bundles={bundles} day={state.day} clockAt={clockAt} busy={addToPlan.busy} onAdd={(e) => { void addToPlan.add(e) }} />
          <p role="status" className="visually-hidden">{addToPlan.message}</p>
          {plan.items.some((i) => i.status !== 'cancelled') && <p><Button variant="secondary" onClick={addToCalendar}>{t('plan.today.calendar')}</Button></p>}
        </>
      )}
      <section aria-labelledby="tp-add" data-tour="plan-add">
        <h2 id="tp-add" tabIndex={-1}><PillIcon heading label={t('plan.bundle.pill.explorers')} />{headingCase(t('plan.today.add'))}</h2>
        <PathLinkList items={LINKS.map(([, to]) => ({ path: to, query: `day=${state.day}` }))} />
      </section>
    </div>
  )
}

/** The saved dishes to show on a dining line: those at that venue. */
const dishesOnLine = (i: PlanItem, saved: Parameters<typeof dishesAt>[0]): string[] => (i.explorer === 'dining' && i.status !== 'cancelled' ? dishesAt(saved, i.venueId) : [])

function changeText(i: PlanItem): string {
  const was = formatTime(i.was ?? i.start)
  if (i.status === 'cancelled') return i.reason ? t('plan.today.cancelledWhy', { title: i.title, reason: i.reason }) : t('plan.today.cancelled', { title: i.title })
  return i.reason ? t('plan.today.movedWhy', { title: i.title, was, time: formatTime(i.start), reason: i.reason }) : t('plan.today.moved', { title: i.title, was, time: formatTime(i.start) })
}

function PlanRow({ item, day, clash, hint, clockAt, dishes, alternatives, onAdd, onRemove, busy }: { item: PlanItem; onRemove: (e: { id: string; title: string }) => Promise<boolean>; day: number; clash?: PlanItem[]; hint?: WalkHint; clockAt: (epoch: number) => string; dishes: string[]; alternatives: Alternative[]; onAdd: (events: { id: string; title: string }[]) => Promise<boolean>; busy: boolean }) {
  const cancelled = item.status === 'cancelled'
  const [inviting, setInviting] = useState(false)
  return (
    <li className={`event${cancelled ? ' event--cancelled' : ''}${item.link ? ' event--link' : ''}`}>
      {hint && <p className="muted" role="note">{t(hint.tight ? 'plan.today.walkTight' : 'plan.today.walk', { minutes: hint.minutes, place: hint.from.venueTitle, time: clockAt(hint.leaveBy) })}</p>}
      <h3 className="event__title event__title--icon">
        {item.kind === 'tour' ? <MapPin className="explorer-icon" aria-hidden="true" focusable="false" /> : <ExplorerIcon kind={item.explorer} />}
        {cancelled ? <s>{item.title}</s> : item.link ? <Link to={item.link} className="event__stretch">{item.title}</Link> : item.title}
      </h3>
      {item.tentative && <p className="event__tags"><StatusBadge kind="waitlist" label={t('plan.today.notBooked')} /></p>}
      {(cancelled || item.status === 'moved') && <p className="event__tags">{cancelled ? <StatusBadge kind="cancelled" label={t('exp.event.cancelled')} /> : <StatusBadge kind="changed" label={t('exp.event.moved', { was: formatTime(item.was ?? item.start) })} />}</p>}
      <ul className="event__times">
        <li><TimeOfDayIcon time={item.start} /><time>{formatTime(item.start)}</time>&nbsp;{t('plan.today.until', { time: clockAt(item.endAt) })}</li>
      </ul>
      {item.detail && <p className="event__detail">{item.detail}</p>}
      {item.venueTitle && item.venueTitle !== item.title && <p className="event__where"><Link className="event__inner-link" to={item.link ?? `${EXPLORER_PATHS[item.explorer]}/${item.venueId}?day=${day}`}>{item.venueTitle}</Link></p>}
      {dishes.length > 0 && <p className="event__dishes"><Bookmark aria-hidden="true" focusable="false" /> {t('plan.today.toTry', { dishes: dishes.join(', ') })}</p>}
      {clash && clash.length > 0 && <p className="exp-event__clash" role="note">{t('exp.event.clash', { title: clash[0].title })}</p>}
      {alternatives.length > 0 && (
        <div role="group" aria-label={t('plan.alt.title')}>
          <p className="muted">{t(item.status === 'cancelled' ? 'plan.alt.cancelled' : item.status === 'moved' ? 'plan.alt.moved' : 'plan.alt.clash')}</p>
          <ul className="icon-list">
            {alternatives.map((a) => (
              <li key={a.id}><ExplorerIcon kind={a.explorer} /><div><Link className="event__inner-link" to={`${EXPLORER_PATHS[a.explorer]}/${a.venueId}?day=${day}`}>{a.start ? t('plan.alt.event', { title: a.title, time: formatTime(a.start), venue: a.venueTitle }) : t('plan.alt.place', { title: a.title })}</Link>{a.start && <div className="plan-add"><Button variant="secondary" disabled={busy} aria-label={t('exp.add.label', { title: a.title })} onClick={() => { void onAdd([{ id: a.id, title: a.title }]) }}>{t('exp.add.button')}</Button></div>}</div></li>
            ))}
          </ul>
        </div>
      )}
      {!cancelled && (
        <div className="plan-add button-row">
          <Button variant="secondary" icon={Plus} aria-label={t('plan.today.inviteLabel', { title: item.title })} onClick={() => setInviting(true)}>{t('plan.today.invite')}</Button>
          {item.kind === 'event' && <Button variant="secondary" disabled={busy} aria-label={t('plan.today.removeLabel', { title: item.title })} onClick={() => { void onRemove({ id: item.id, title: item.title }) }}>{t('plan.today.remove')}</Button>}
        </div>
      )}
      {inviting && <InviteDialog title={item.title} message={t('plan.today.inviteMessage', { title: item.title, time: formatTime(item.start), place: item.venueTitle || item.title, day: String(day) })} onClose={() => setInviting(false)} />}
    </li>
  )
}
