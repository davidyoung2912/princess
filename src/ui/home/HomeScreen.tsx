import { Link } from 'react-router'
import type { TripView } from '../../api/types'
import { formatDate, sailingRange } from '../../domain/cruise'
import { sailingById } from '../../domain/sailings'
import { dateIn } from '../../domain/timezones'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { LinkButton } from '../Button'
import { Card } from '../Card'
import { ConceptNotice } from '../ConceptNotice'
import { Explore } from '../discover/Landing'
import { countdown } from '../account/format'
import { NextStep } from '../account/tripParts'

/** The trip the guest is on, from the trips list: their own booking first. */
const pickTrip = (upcoming: readonly TripView[]): TripView | null => upcoming.find((x) => x.kind === 'current') ?? upcoming[0] ?? null

/** Home for a booked guest: the one next step, then the cruise to browse. The next step follows the stage of the trip (UX-01, UX-02: required tasks first, no offers). */
export function HomeScreen() {
  const trips = useMine(() => api.trips.list())
  const trip = trips.data ? pickTrip(trips.data.upcoming) : null
  return (
    <div className="page">
      <h1>{trip ? sailingRange(sailingById(trip.sailingId)!) : t('route.home')}</h1>
      {trip && <Journey trip={trip} />}
      <p><Link to="/home/find-pass">{t('route.findPass')}</Link></p>
      <Explore />
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
      <p className="muted">{t('trip.booking', { number: trip.number })} · <strong>{countdown(trip.daysToDeparture)}</strong></p>
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
    </section>
  )
}
