import { useState } from 'react'
import { Link } from 'react-router'
import type { HistoryTrip, HistoryView } from '../../api/finishTypes'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/money'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { formatDateTime } from '../account/format'
import { BackLink } from '../onboard/common'
import { Human } from './common'
import { matchTrips } from '../../domain/historySearch'

/** Trip history (POS-01, POS-04): every cruise sailed, its receipts and tax summaries, and the photo download window. */
export function HistoryScreen() {
  const view = useMine(() => api.post.history(), [])
  return (
    <div className="page">
      <p>{t('hist.intro')}</p>
      <Load state={view}>{(v) => <History v={v} />}</Load>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}

function History({ v }: { v: HistoryView }) {
  const [q, setQ] = useState('')
  const trips = matchTrips(v.trips, q)
  return (
    <>
      {v.photosUntil !== null && (
        <Banner kind="info" title={t('hist.photos', { time: formatDateTime(v.photosUntil) })} action={<Link to="/ship/photos">{t('route.photos')}</Link>}>
          <p>{t('hist.photosBody')}</p>
        </Banner>
      )}
      {v.sailed && <p><Link to="/me/feedback">{t('route.feedback')}</Link> · <Link to="/me/loyalty">{t('route.loyalty')}</Link> · <Link to="/me/rebook">{t('route.rebook')}</Link></p>}
      {v.trips.length > 1 && (
        <div className="field">
          <label htmlFor="hist-q">{t('hist.search')}</label>
          <input id="hist-q" type="search" className="field__input" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {v.trips.length === 0 ? <p className="muted">{t('hist.none')}</p> : trips.length === 0 ? <p role="status" className="muted">{t('hist.noMatch')}</p> : <div>{trips.map((trip) => <Trip key={trip.id} trip={trip} />)}</div>}
      <p className="muted">{t('hist.memories')}</p>
      <Human />
    </>
  )
}

function Trip({ trip }: { trip: HistoryTrip }) {
  const id = `hist-${trip.id}`
  return (
    <Card labelledBy={id}>
      <h2 id={id} className="card__title">{trip.title}</h2>
      <p>{trip.ship} · {formatDate(trip.departure)} · {t('hist.nights', { count: trip.nights })}</p>
      {trip.cancelled && <p><strong>{t('hist.cancelled')}</strong></p>}
      {trip.fareCents !== null && <p>{t('hist.fare', { amount: formatMoney(trip.fareCents) })}</p>}
      {trip.documents.length > 0 && (
        <>
          <h3>{th('hist.docs')}</h3>
          <ul className="plain-bullets">{trip.documents.map((d) => <li key={d.id}>{t(`hist.doc.${d.id}` as StringKey)}</li>)}</ul>
          <p>{trip.current ? <Link to="/me/bill/final">{t('route.finalBill')}</Link> : <Link to="/me/contact">{t('hist.ask')}</Link>}</p>
        </>
      )}
    </Card>
  )
}
