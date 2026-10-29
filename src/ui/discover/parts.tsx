import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { t, type StringKey } from '../../i18n'
import { formatDate, formatTime, routePoints, ROUTE, stops } from '../../domain/cruise'
import type { Favourites } from '../../hooks/useFavourites'
import { favouriteKey, shareUrl, type FavouriteKind } from '../../domain/favourites'
import { formatMoney, type FromPrice, type Quote } from '../../domain/pricing'
import { PORTS, type Sailing } from '../../domain/sailings'
import { Anchor, Bookmark, BookmarkCheck, Share, Waves } from '../icons'
import { Banner } from '../Banner'
import { Button } from '../Button'
import type { Async } from '../../hooks/useAsync'

/** Save and Share for one thing. The name is read out but not repeated on screen; `aria-pressed` carries saved or not. */
export function SaveShare({ kind, id, name, favourites }: { kind: FavouriteKind; id: string; name: string; favourites: Favourites }) {
  const key = favouriteKey(kind, id)
  const saved = favourites.has(key)
  const [note, setNote] = useState('')
  const Icon = saved ? BookmarkCheck : Bookmark

  const share = async () => {
    const url = shareUrl(window.location.origin, kind, id)
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: name, url })
      else { await navigator.clipboard.writeText(url); setNote(t('discover.linkCopied')) }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setNote(t('discover.linkFailed', { url }))
    }
  }

  return (
    <div className="save-share">
      <div className="button-row">
        <Button variant="secondary" aria-pressed={saved} disabled={!favourites.ready} onClick={() => void favourites.toggle(key)}>
          <Icon aria-hidden="true" />
          <span>{t('discover.save')}<span className="visually-hidden"> {name}</span></span>
        </Button>
        <Button variant="tertiary" onClick={() => void share()}>
          <Share aria-hidden="true" />
          <span>{t('discover.share')}<span className="visually-hidden"> {name}</span></span>
        </Button>
      </div>
      <p className="muted" role="status">{favourites.failed ? t('discover.saveFailed') : saved ? t('discover.saved') : ''}{note && ` ${note}`}</p>
    </div>
  )
}

/** The "couldn't load" state: says what happened, offers a retry, and points to a person. */
export function LoadError({ retry }: { retry: () => void }) {
  return (
    <Banner kind="danger" title={t('discover.error.title')} action={<Button variant="secondary" onClick={retry}>{t('error.tryAgain')}</Button>}>
      <p>{t('discover.error.body')}</p>
    </Banner>
  )
}

/** "From $1,539 per person" with what is added on top, so the price is not a teaser. */
export function FromPriceBlock({ price }: { price: FromPrice }) {
  return (
    <div className="price">
      <p className="price__from">{t('discover.from')} <strong className="price__amount">{formatMoney(price.fare)}</strong> {t('discover.perPerson')}</p>
      <p className="muted">{t('discover.plusFees', { taxes: formatMoney(price.taxes), tips: formatMoney(price.gratuities), total: formatMoney(price.allIn) })}</p>
    </div>
  )
}

export function PriceState({ state, children }: { state: Async<unknown> & { retry: () => void }; children: ReactNode }) {
  if (state.status === 'error' && !state.data) return <LoadError retry={state.retry} />
  if (state.status === 'loading' && !state.data) return <p role="status" className="muted">{t('discover.loading')}</p>
  return <>{children}</>
}

/** The day-by-day plan. The same order sails every week, so dates appear only when a sailing is given. */
export function ItineraryList({ sailing, dated }: { sailing: Sailing; dated?: boolean }) {
  return (
    <ol className="itinerary">
      {stops(sailing).map((d) => (
        <li key={d.day} className="itinerary__day">
          <div className="itinerary__head">
            <span className="itinerary__num">{t('discover.day', { day: d.day })}</span>
            {dated && <span className="muted">{formatDate(d.date)}</span>}
          </div>
          <p className="itinerary__place">
            {d.port === 'sea' ? d.place : <Link to={`/home/ports/${d.port}`}>{d.place}</Link>}
          </p>
          {d.port === 'sea' ? (
            <p className="muted"><Waves aria-hidden="true" /> {t('discover.seaDay')}</p>
          ) : (
            <>
              <p className="muted">
                {[d.arrive && t('discover.arrive', { time: formatTime(d.arrive) }), d.allAboard && t('discover.allAboard', { time: formatTime(d.allAboard) }), d.depart && t('discover.depart', { time: formatTime(d.depart) })].filter(Boolean).join(' · ')}
              </p>
              {d.port !== 'fll' && (
                <p><span className={`tag${d.tender ? ' tag--alert' : ''}`}><Anchor aria-hidden="true" /> {d.tender ? t('discover.tender') : t('discover.dock')}</span></p>
              )}
            </>
          )}
        </li>
      ))}
    </ol>
  )
}

const W = 300
const H = 200

/** A sketch of the route with numbered stops; the list beside it carries the same information in words. */
export function RouteMap() {
  const pts = routePoints(W, H)
  const path = [...ROUTE, 'fll' as const].map((id) => `${pts[id].x},${pts[id].y}`).join(' ')
  const names = ROUTE.map((id) => (id === 'fll' ? 'Fort Lauderdale' : PORTS[id].name.split(',')[0]))
  return (
    <figure className="route-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('discover.mapLabel', { stops: names.join(', ') })}>
        <polyline points={path} className="route-map__line" fill="none" />
        {ROUTE.map((id, i) => (
          <g key={id} transform={`translate(${pts[id].x} ${pts[id].y})`}>
            <circle r="13" className="route-map__dot" />
            <text textAnchor="middle" dominantBaseline="central" className="route-map__num">{i + 1}</text>
          </g>
        ))}
      </svg>
      <figcaption>
        <ol className="route-map__legend">
          {ROUTE.map((id, i) => <li key={id} value={i + 1}>{names[i]}{id === 'fll' ? ` ${t('discover.startFinish')}` : ''}</li>)}
        </ol>
      </figcaption>
    </figure>
  )
}

/** Every charge as a row, so the total hides nothing. */
export function PriceBreakdown({ quote }: { quote: Quote }) {
  return (
    <table className="price-table">
      <caption>{t('discover.breakdown', { count: quote.guests })}</caption>
      <thead>
        <tr><th scope="col">{t('discover.charge')}</th><th scope="col" className="num">{t('discover.amount')}</th></tr>
      </thead>
      <tbody>
        {quote.lines.map((l) => (
          <tr key={l.key}>
            <th scope="row">
              {t(`discover.line.${l.key}` as StringKey, { count: l.guests })}
              {l.key === 'gratuities' && <small className="muted">{t('discover.line.gratuitiesNote')}</small>}
              {l.key === 'taxes' && <small className="muted">{t('discover.line.taxesNote')}</small>}
            </th>
            <td className="num">{formatMoney(l.cents)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr><th scope="row">{t('discover.total')}</th><td className="num">{formatMoney(quote.total)}</td></tr>
        <tr><th scope="row">{t('discover.totalPerPerson')}</th><td className="num">{formatMoney(quote.perPerson)}</td></tr>
      </tfoot>
    </table>
  )
}
