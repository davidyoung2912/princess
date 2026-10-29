import { Link } from 'react-router'
import { sailingRange } from '../../domain/cruise'
import { sailingById } from '../../domain/sailings'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { usePersona } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Card } from '../Card'
import { ConceptNotice } from '../ConceptNotice'
import { countdown, formatMoment } from './format'
import { Load } from './parts'
import { NextStep, PaymentBadge } from './tripParts'

const GROUPS: readonly { id: string; titleKey: StringKey; links: readonly { to: string; key: StringKey; badge?: 'unread' }[] }[] = [
  { id: 'trip', titleKey: 'me.group.trip', links: [{ to: '/me/trips', key: 'route.trips' }, { to: '/me/documents', key: 'route.documents' }, { to: '/me/payments', key: 'route.payments' }, { to: '/me/bill', key: 'route.bill' }, { to: '/me/bill/final', key: 'route.finalBill' }, { to: '/me/packages', key: 'route.packages' }] },
  { id: 'after', titleKey: 'me.group.after', links: [{ to: '/me/recap', key: 'route.recap' }, { to: '/me/history', key: 'route.history' }, { to: '/me/feedback', key: 'route.feedback' }, { to: '/me/cases', key: 'route.cases' }, { to: '/me/loyalty', key: 'route.loyalty' }, { to: '/me/rebook', key: 'route.rebook' }, { to: '/me/sustainability', key: 'route.sustainability' }] },
  { id: 'account', titleKey: 'me.group.account', links: [{ to: '/me/profile', key: 'route.profile' }, { to: '/me/notifications', key: 'route.notifications', badge: 'unread' }, { to: '/me/helper', key: 'route.helper' }, { to: '/me/settings', key: 'route.settings' }] },
  { id: 'help', titleKey: 'me.group.help', links: [{ to: '/me/help', key: 'route.helpCentre' }, { to: '/me/contact', key: 'route.contact' }] },
]

/** Me: who you are, your trip at a glance, and everything about the account in one place. */
export function MeScreen() {
  const me = usePersona()
  const trips = useMine(() => api.trips.list())
  const notices = useMine(() => api.notifications.list())
  const history = useMine(() => api.account.history())
  const unread = notices.data ? notices.data.notices.filter((n) => !n.read).length : 0
  const trip = trips.data?.upcoming[0]

  return (
    <div className="page">
      <h1>{t('route.me')}</h1>
      {me && (
        <Card>
          <p className="me-name">{me.name}</p>
          <p className="muted">{me.tier === 'none' ? t('me.noTier') : t('me.tier', { tier: t(`me.tier.${me.tier}` as StringKey) })}</p>
        </Card>
      )}

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

      {GROUPS.map((g) => (
        <section key={g.id} aria-labelledby={`${g.id}-h`}>
          <h2 id={`${g.id}-h`}>{t(g.titleKey)}</h2>
          <ul className="link-list">
            {g.links.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{t(l.key)}{l.badge === 'unread' && unread > 0 && <span className="tag tag--alert">{t('me.unread', { count: unread })}</span>}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

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
