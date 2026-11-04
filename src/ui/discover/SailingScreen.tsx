import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { t, th } from '../../i18n'
import { MAX_GUESTS } from '../../domain/priceShapes'
import { rangeOf, browseSailingById, nextLegOf, browseSailings, portsOf, seaDaysOf, portName, type BrowseSailing } from '../../domain/catalogueBrowse'
import type { Sailing } from '../../domain/sailings'
import { hasSailingDays, sailingById } from '../../domain/sailings'
import { CATEGORIES, categoryById, type CategoryId } from '../../domain/ship'
import { loadItinerary } from '../../domain/shipCatalogue'
import { api } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { useCatalogue } from '../../hooks/useCatalogue'
import { useFavourites } from '../../hooks/useFavourites'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { ItineraryList, PriceBreakdown, PriceState, SaveShare } from './parts'
import { useJourneyEvent } from '../../hooks/useJourneyEvent'
import { PriceUnitLine } from '../delights/Delights'
import { DayStrip, LandHolidayCompare, OnThatDate } from '../delights/DiscoverDelights'
import { CataloguePrice, DataStatusNote, SailingFactsList } from './catalogueParts'

/** The price estimate for a sailing that can be booked: a room type and party size give an all-in quote. */
function Estimate({ sailing, nights }: { sailing: Sailing; nights: number }) {
  const [category, setCategory] = useState<CategoryId>('balcony')
  const [guests, setGuests] = useState(2)
  const quote = useAsync(() => api.discover.quote(sailing.id, category, guests), [sailing.id, category, guests])
  return (
    <section aria-labelledby="price-h">
      <h2 id="price-h">{th('discover.estimate')}</h2>
      <p>{t('discover.estimateIntro')}</p>
      <div className="field">
        <label htmlFor="room">{t('discover.roomType')}</label>
        <select id="room" value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <p className="field__hint">{categoryById(category)!.summary}</p>
      </div>
      <div className="field">
        <label htmlFor="guests">{t('discover.guests')}</label>
        <select id="guests" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
          {Array.from({ length: MAX_GUESTS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div aria-busy={quote.status === 'loading'}>
        <PriceState state={quote}>{quote.data && <PriceBreakdown quote={quote.data} />}</PriceState>
      </div>
      {quote.data && <PriceUnitLine total={quote.data.total} guests={guests} nights={nights} />}
      {quote.data && <LandHolidayCompare sailing={sailing} total={quote.data.total} guests={guests} />}
      <Card info><p>{t('discover.estimateNote')}</p></Card>
      <p><Link to="/home/cruise/cost">{t('cost.link')}</Link> · <Link to="/home/cabins">{t('route.cabins')}</Link> · <Link to="/home/decide">{t('route.decide')}</Link></p>
    </section>
  )
}

/** The legs of a joined sailing, or the offer to add the next leg to a single one. */
function Legs({ sailing }: { sailing: BrowseSailing }) {
  const next = nextLegOf(sailing, browseSailings())
  if (sailing.legs.length <= 1 && !next) return null
  return (
    <section aria-labelledby="legs-h">
      <h2 id="legs-h">{th('cat.legsTitle')}</h2>
      {sailing.legs.length > 1 && <p>{t('cat.legs', { count: sailing.legs.length })}</p>}
      {next && <p><Link to={`/home/sailings/${next.id}`}>{t('cat.addNextLong', { nights: next.nights, range: rangeOf(next) })}</Link></p>}
    </section>
  )
}

/** One sailing of any ship: its dated plan, the ports and sea days, and, when it can be booked, an all-in price estimate for a room type and party size (H08). */
export function SailingScreen() {
  const { id } = useParams()
  useCatalogue()
  const entry = browseSailingById(id)
  const sailing: Sailing | undefined = entry ? (sailingById(entry.id) ?? { id: entry.id, departure: entry.departure, holiday: entry.holiday }) : undefined
  useJourneyEvent('lookCloser', entry?.id)
  const favourites = useFavourites()
  // The days of a sailing come from the server when this page asks for them; the older route's days show meanwhile.
  const entryId = entry?.id
  useEffect(() => { if (entryId) void loadItinerary(entryId) }, [entryId])

  if (!entry || !sailing) {
    return (
      <div className="page">
        <Banner kind="warning" title={t('discover.notFound.sailing')} action={<LinkButton to="/home/sailings" variant="secondary">{t('discover.seeDates')}</LinkButton>}>
          <p>{t('discover.notFound.body')}</p>
        </Banner>
      </div>
    )
  }
  const range = rangeOf(entry)
  // A sailing off the older route has its own days only once the server has answered; until then the older template would be the wrong ports.
  const daysReady = !!sailingById(entry.id) || hasSailingDays(entry.id)
  const ports = portsOf(entry)
  const sea = seaDaysOf(entry)
  return (
    <div className="page">
      <h2>{entry.title}</h2>
      <p>{range}</p>
      <p>
        {entry.holiday && <span className="tag">{t('discover.holiday')}</span>}
        {!entry.bookingOpen && <span className="tag">{t('cat.browseOnly')}</span>}
      </p>
      <SailingFactsList sailing={entry} />
      {entry.bookingOpen ? <div className="button-row"><LinkButton to={`/book?sailing=${entry.id}`}>{t('discover.book')}</LinkButton></div> : <Card info><p>{t('cat.notBookable')}</p></Card>}
      <SaveShare kind="sailing" id={entry.id} name={`${entry.title}, ${range}`} favourites={favourites} />
      <DataStatusNote sailing={entry} />

      {ports.length > 0 && (
        <section aria-labelledby="ports-h">
          <h2 id="ports-h">{th('cat.portsTitle')}</h2>
          <p>{ports.map(portName).join(', ')}{sea !== null ? ` · ${t('cat.seaDays', { count: sea })}` : ''}</p>
        </section>
      )}
      <Legs sailing={entry} />

      {entry.bookingOpen
        ? <Estimate sailing={sailing} nights={entry.nights} />
        : (
          <section aria-labelledby="price-h">
            <h2 id="price-h">{th('cat.priceTitle')}</h2>
            <CataloguePrice sailing={entry} />
            <Card info><p>{t('cat.priceNote')}</p></Card>
          </section>
        )}

      {daysReady ? (
        <>
          <DayStrip sailing={sailing} />
          <section aria-labelledby="plan-h">
            <h2 id="plan-h">{th('discover.dayByDay')}</h2>
            <ItineraryList sailing={sailing} dated />
            <p><Link to={`/home/cruise?sailing=${entry.id}`}>{t('cat.seeRoute')}</Link></p>
          </section>
          <OnThatDate key={entry.id} sailing={sailing} />
        </>
      ) : <p role="status" className="muted">{t('cat.daysLoading')}</p>}
      <p><Link to="/home/sailings">{t('discover.allDates')}</Link> · <Link to="/home/saved/compare">{t('cat.compareSaved')}</Link></p>
    </div>
  )
}
