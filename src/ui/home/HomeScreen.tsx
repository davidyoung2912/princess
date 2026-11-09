import { DeadlineNotes } from './DeadlineNotes'
import { QuickDiary } from '../delights/TripDiary'
import { EssentialsHome } from '../delights/EmbarkDelights'
import { useSettings } from '../../hooks/useSettings'
import { PostcardArrives } from '../delights/RememberDelights'
import { HomeReadyCard, NicknameLine, ReminderDueCard, SmallThingCard } from '../delights/PrepareDelights'
import { Link } from 'react-router'
import type { TripView } from '../../api/types'
import { formatDate, sailingRange } from '../../domain/cruise'
import { sailingById } from '../../domain/sailings'
import { dateIn } from '../../domain/timezones'
import { api } from '../../runtime'
import { useSharedMine } from '../../hooks/useSharedMine'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { UpdatesBanner } from '../onboard/Updates'
import { LinkButton } from '../Button'
import { CompanionCard, ContinueBookingCard } from './PrepCards'
import { Card } from '../Card'
import { TabScreens } from '../TabScreens'
import { NewTabsNote } from '../NewTabsNote'
import { ShortcutBar } from '../ShortcutBar'
import { JourneyStrip } from '../JourneyStrip'
import { Explore } from '../discover/Landing'
import { countdown } from '../account/format'
import { NextStep } from '../account/tripParts'
import { Saved } from '../onboard/common'
import { OnboardHome } from '../onboard/OnboardHome'
import { pickTrip } from '../../hooks/useStageFacts'
import { useOnboardToday } from '../../hooks/useOnboardToday'
import { AfterCruiseCard } from '../finish/HomeCards'
import { HomeOfferCard } from '../offers/Offers'
import { StageLanding } from './StageLanding'
import { StageHome } from './StageHome'
import { StageHero } from '../StageHero'
import { RecentCard } from './RecentCard'
import { ABOARD_STAGES, REMEMBER_STAGES, TILE_STAGES, TRIP_STAGES } from '../../routes/stageHome'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { NudgeCards } from './NudgeCards'
import { useCountdowns } from './useCountdowns'
import { useNow } from '../../hooks/useDemo'
import { useMoment } from '../../hooks/useMoment'
import { MomentCard } from '../MomentCard'
import { TodayStrip } from '../TodayStrip'
import { HeroCount } from '../HeroCount'
import { AtmosphereHero } from '../AtmosphereHero'
import { DayHeader } from '../DayHeader'
import { SailAwayCard } from '../SailAwayCard'

/** Home for a booked guest: the one next step, then the cruise to browse. The next step follows the stage of the trip (UX-01, UX-02: required tasks first, no offers). */
export function HomeScreen() {
  const [settings] = useSettings()
  const trips = useSharedMine('trips.list', () => api.trips.list())
  const trip = trips.data ? pickTrip(trips.data.upcoming) : null
  const today = useOnboardToday()
  const { stage } = useJourneyPosition()
  const now = useNow()
  const counts = useCountdowns(trip, now)
  const moment = useMoment(!!today.data?.aboard)
  if (!trip && TILE_STAGES.includes(stage)) return <div className="page"><StageHero stage={stage} /><NewTabsNote /><ShortcutBar /><UpdatesBanner /><StageHome /></div>
  if (trip && TRIP_STAGES.includes(stage) && !today.data?.aboard && !settings.essentials) {
    return (
      <div className="page">
        <StageHero stage={stage} />
        <h2>{sailingRange(sailingById(trip.sailingId)!)}</h2>
        <NewTabsNote /><ShortcutBar />
        <UpdatesBanner />
        <p className="muted">{t('trip.booking', { number: trip.number })}</p>
        <HeroCount days={trip.daysToDeparture} />
        {moment && <MomentCard moment={moment} />}
        {counts.length > 0 && (
          <ul className="muted calm-hide" aria-label={t('count.label')}>
            {counts.map((c) => <li key={c.id}>{c.days === 0 ? t(`count.${c.id}.today` as StringKey) : t(`count.${c.id}` as StringKey, { count: c.days })}</li>)}
          </ul>
        )}
        <NextStep trip={trip} />
        <StageHome trip={trip} />
        <QuickDiary />
      </div>
    )
  }
  if (REMEMBER_STAGES.includes(stage) && !today.data?.aboard && !settings.essentials) {
    const others = trips.data?.upcoming ?? []
    return (
      <div className="page">
        <StageHero stage={stage} />
        <NewTabsNote /><ShortcutBar />
        <UpdatesBanner />
        <StageHome />
        {others.length > 0 && (
          <ul className="link-list">
            {others.map((x) => <li key={x.number}><Link to={`/me/trips/${x.number}`}>{t('stage.otherTrip', { number: x.number })}</Link> · {sailingRange(sailingById(x.sailingId)!)}</li>)}
          </ul>
        )}
      </div>
    )
  }
  if (settings.essentials && !today.data?.aboard) return <EssentialsHome />
  if (today.data?.aboard) {
    return (
      <div className="page page--wide">
        <div className="home-hero">
          <AtmosphereHero stage={stage} today={today.data} />
          <NewTabsNote /><ShortcutBar />
          {moment && <MomentCard moment={moment} />}
        </div>
        <SailAwayCard today={today.data} />
        <DayHeader today={today.data} />
        <TodayStrip />
        {!ABOARD_STAGES.includes(stage) && !moment && <StageLanding />}
        <NudgeCards aboard />
        {ABOARD_STAGES.includes(stage) && <StageHome today={today.data} />}
        <QuickDiary />
        <Saved copy={today}>{(d) => <OnboardHome today={d} />}</Saved>
      </div>
    )
  }
  return (
    <div className="page">
      <StageHero stage={stage} />
      {trip && <h2>{sailingRange(sailingById(trip.sailingId)!)}</h2>}
      <NewTabsNote /><ShortcutBar />
      {moment ? <MomentCard moment={moment} /> : <StageLanding />}
      {trip && <HeroCount days={trip.daysToDeparture} />}
      <RecentCard />
      {trip && <JourneyStrip />}
      <UpdatesBanner />
      <NudgeCards aboard={false} />
      <AfterCruiseCard />
      <ContinueBookingCard />
      {trip && <NicknameLine />}
      <ReminderDueCard />
      {trip && <CompanionCard daysToDeparture={trip.daysToDeparture} />}
      {trip && <PostcardArrives sailingId={trip.sailingId} daysToDeparture={trip.daysToDeparture} />}
      {trip && <HomeReadyCard />}
      {trip && <SmallThingCard daysToDeparture={trip.daysToDeparture} />}
      {trip && <Journey trip={trip} />}
      <HomeOfferCard />
      <p><Link to="/home/find-pass">{t('route.findPass')}</Link></p>
      <p><Link to="/home/concierge">{t('route.concierge')}</Link> · <Link to="/home/ask">{t('route.ask')}</Link> · <Link to="/home/briefing">{t('route.briefing')}</Link> · <Link to="/home/summary">{t('route.summary')}</Link></p>
      <p><Link to="/home/quiz">{t('route.quiz')}</Link> · <Link to="/home/advisors">{t('route.advisors')}</Link></p>
      <TabScreens tabKey="home" />
      <div className="simple-hide"><Explore /></div>
    </div>
  )
}

function Journey({ trip }: { trip: TripView }) {
  const done = trip.checkin.state === 'done'
  const closed = trip.checkin.state === 'closed' && !done
  const near = trip.daysToDeparture <= 3 && trip.daysToDeparture >= 0
  const counts = useCountdowns(trip, useNow())
  return (
    <section aria-labelledby="next-h">
      <h2 id="next-h">{th('home.next')}</h2>
      <p className="muted">{t('trip.booking', { number: trip.number })} <strong className="calm-hide">· {countdown(trip.daysToDeparture)}</strong></p>
      {counts.length > 0 && (
        <ul className="muted calm-hide" aria-label={t('count.label')}>
          {counts.map((c) => <li key={c.id}>{c.days === 0 ? t(`count.${c.id}.today` as StringKey) : t(`count.${c.id}` as StringKey, { count: c.days })}</li>)}
        </ul>
      )}
      <DeadlineNotes counts={counts} />
      {done ? (
        <Card hero labelledBy="pass-h">
          <h3 id="pass-h" className="card__title">{th('home.passReady')}</h3>
          <p>{t('home.passReadyBody')}</p>
          <div className="button-row">
            <LinkButton to="/home/boarding-pass">{t('home.showPass')}</LinkButton>
            <LinkButton to="/home/embarkation" variant="secondary">{t('route.embarkation')}</LinkButton>
          </div>
        </Card>
      ) : closed ? (
        <Banner kind="warning" title={t('checkin.closed')} action={<LinkButton to="/home/check-in/terminal" variant="secondary">{t('route.terminalCheckin')}</LinkButton>}><p>{t('checkin.closedBody')}</p></Banner>
      ) : (
        <>
          <NextStep trip={trip} />
          {trip.checkin.state === 'notOpen' && <p>{t('home.checkinOpens', { date: formatDate(dateIn(trip.checkin.opensAt, 'America/New_York')) })} <Link to="/plan/checklist">{t('route.checklist')}</Link></p>}
          {trip.checkin.state === 'open' && trip.next !== 'checkin' && <p><Link to="/home/check-in">{t('route.checkin')}</Link></p>}
        </>
      )}
      {near && !done && <p><Link to="/home/embarkation">{t('route.embarkation')}</Link></p>}
      <p><Link to={`/me/trips/${trip.number}`}>{t('home.tripPage')}</Link> · <Link to="/plan">{t('route.plan')}</Link></p>
      <p><Link to="/home/medallion">{t('route.medallion')}</Link> · <Link to="/home/luggage">{t('route.luggage')}</Link> · <Link to="/home/clearance">{t('route.clearance')}</Link></p>
    </section>
  )
}
