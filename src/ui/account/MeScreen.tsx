import { Link } from 'react-router'
import { sailingRange } from '../../domain/cruise'
import { sailingById } from '../../domain/sailings'
import { api, signOutSaving } from '../../runtime'
import { useSyncStatus } from '../../hooks/useSyncStatus'
import { useMine } from '../../hooks/useMine'
import { usePersona } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { HubList } from '../HubList'
import { ConceptNotice } from '../ConceptNotice'
import { countdown, formatMoment } from './format'
import { Load } from './parts'
import { NextStep, PaymentBadge } from './tripParts'

/** Me: who you are, your trip at a glance, and everything about the account in one place. */
export function MeScreen() {
  const me = usePersona()
  const trips = useMine(() => api.trips.list())
  const notices = useMine(() => api.notifications.list())
  const history = useMine(() => api.account.history())
  const unread = notices.data ? notices.data.notices.filter((n) => !n.read).length : 0
  const trip = trips.data?.upcoming[0]
  const syncState = useSyncStatus()

  return (
    <div className="page">
      <h1>{t('route.me')}</h1>
      {me && (
        <Card>
          <p className="me-name">{me.name}</p>
          <p className="muted">{me.tier === 'none' ? t('me.noTier') : t('me.tier', { tier: t(`me.tier.${me.tier}` as StringKey) })}</p>
        </Card>
      )}

      <p role="status" className="muted">{t(`sync.${syncState}` as StringKey)}</p>
      <p><Button variant="secondary" onClick={() => void signOutSaving()}>{t('signin.signOut')}</Button></p>

      <section aria-labelledby="me-trip-h">
        <h2 id="me-trip-h">{t('me.yourTrip')}</h2>
        <Load state={trips}>
          {() => trip ? (
            <Card>
              <h3 className="card__title"><Link to={`/me/trips/${trip.number}`}>{sailingRange(sailingById(trip.sailingId)!)}</Link></h3>
              <p><strong>{countdown(trip.daysToDeparture)}</strong> <PaymentBadge trip={trip} /></p>
              <NextStep trip={trip} />
            </Card>
          ) : <Card info><p>{t('trips.noneUpcoming')}</p></Card>}
        </Load>
      </section>

      <HubList tab="me" badges={{ '/me/notifications': unread > 0 ? <span className="tag tag--alert">{t('me.unread', { count: unread })}</span> : null }} />

      <section aria-labelledby="hist-h">
        <h2 id="hist-h">{t('me.history')}</h2>
        <p className="muted">{t('me.historyIntro')}</p>
        <Load state={history}>
          {(list) => list.length === 0 ? <p className="muted">{t('me.historyNone')}</p> : (
            <ul className="plain-list">
              {list.slice(0, 6).map((h) => <li key={h.id}><span>{t(`me.history.${h.what}` as StringKey)}: {h.detail} <span className="muted">· {h.by} · {formatMoment(h.at)}</span></span></li>)}
            </ul>
          )}
        </Load>
      </section>
      <ConceptNotice />
    </div>
  )
}
