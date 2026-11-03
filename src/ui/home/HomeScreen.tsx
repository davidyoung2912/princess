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
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { UpdatesBanner } from '../onboard/Updates'
import { LinkButton } from '../Button'
import { CompanionCard, ContinueBookingCard } from './PrepCards'
import { Card } from '../Card'
import { HubList } from '../HubList'
import { JourneyStrip } from '../JourneyStrip'
import { ConceptNotice } from '../ConceptNotice'
import { Explore } from '../discover/Landing'
import { countdown } from '../account/format'
import { NextStep } from '../account/tripParts'
import { Saved } from '../onboard/common'
import { OnboardHome } from '../onboard/OnboardHome'
import { useOnboardToday } from '../../hooks/useOnboardToday'
import { AfterCruiseCard } from '../finish/HomeCards'
import { HomeOfferCard } from '../offers/Offers'
import { NudgeCards } from './NudgeCards'

/** The trip the guest is on, from the trips list: their own booking first. */
const pickTrip = (upcoming: readonly TripView[]): TripView | null => upcoming.find((x) => x.kind === 'current') ?? upcoming[0] ?? null

/** Home for a booked guest: the one next step, then the cruise to browse. The next step follows the stage of the trip (UX-01, UX-02: required tasks first, no offers). */
export function HomeScreen() {
  const [settings] = useSettings()
  const trips = useMine(() => api.trips.list())
  const trip = trips.data ? pickTrip(trips.data.upcoming) : null
  const today = useOnboardToday()
  if (settings.essentials && !today.data?.aboard) return <EssentialsHome />
  if (today.data?.aboard) {
    return (
      <div className="page">
        <h1>{t('route.home')}</h1>
        <JourneyStrip />
        <NudgeCards aboard />
        <Saved copy={today}>{(d) => <OnboardHome today={d} />}</Saved>
        <HomeOfferCard />
        <HubList tab="home" />
        <ConceptNotice />
      </div>
    )
  }
  return (
    <div className="page">
      <h1>{trip ? sailingRange(sailingById(trip.sailingId)!) : t('route.home')}</h1>
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
      <HubList tab="home" />
      <div className="simple-hide"><Explore /></div>
      <ConceptNotice />
    </div>
  )
}

function Journey({ trip }: { trip: TripView }) {
  const done = trip.checkin.state === 'done'
  const closed = trip.checkin.state === 'closed' && !done
  const near = trip.daysToDeparture <= 3 && trip.daysToDeparture >= 0
  return (
    <section aria-labelledby="next-h">
      <h2 id="next-h">{t('home.next')}</h2>
      <p className="muted">{t('trip.booking', { number: trip.number })} <strong className="calm-hide">· {countdown(trip.daysToDeparture)}</strong></p>
      {done ? (
        <Card hero labelledBy="pass-h">
          <h3 id="pass-h" className="card__title">{t('home.passReady')}</h3>
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
