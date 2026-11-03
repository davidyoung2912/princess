import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { t, th } from '../../i18n'
import { sailingRange } from '../../domain/cruise'
import { MAX_GUESTS } from '../../domain/priceShapes'
import { sailingById, sailingNights } from '../../domain/sailings'
import { CATEGORIES, categoryById, type CategoryId } from '../../domain/ship'
import { api } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { useFavourites } from '../../hooks/useFavourites'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { ItineraryList, PriceBreakdown, PriceState, SaveShare } from './parts'
import { useJourneyEvent } from '../../hooks/useJourneyEvent'
import { PriceUnitLine } from '../delights/Delights'
import { DayStrip, LandHolidayCompare, OnThatDate } from '../delights/DiscoverDelights'

/** One sailing: its dated plan and an all-in price estimate for a room type and party size (DIS-05, DIS-11). */
export function SailingScreen() {
  const { id } = useParams()
  const sailing = sailingById(id)
  useJourneyEvent('lookCloser', sailing?.id)
  const favourites = useFavourites()
  const [category, setCategory] = useState<CategoryId>('balcony')
  const [guests, setGuests] = useState(2)
  const quote = useAsync(() => (sailing ? api.discover.quote(sailing.id, category, guests) : Promise.reject(new Error('unknown sailing'))), [sailing?.id, category, guests])

  if (!sailing) {
    return (
      <div className="page">
        <Banner kind="warning" title={t('discover.notFound.sailing')} action={<LinkButton to="/home/sailings" variant="secondary">{t('discover.seeDates')}</LinkButton>}>
          <p>{t('discover.notFound.body')}</p>
        </Banner>
      </div>
    )
  }
  const range = sailingRange(sailing)
  return (
    <div className="page">
      <h2>{range}</h2>
      {sailing.holiday && <p><span className="tag">{t('discover.holiday')}</span></p>}
      <div className="button-row"><LinkButton to={`/book?sailing=${sailing.id}`}>{t('discover.book')}</LinkButton></div>
      <SaveShare kind="sailing" id={sailing.id} name={range} favourites={favourites} />

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
        {quote.data && <PriceUnitLine total={quote.data.total} guests={guests} nights={sailingNights(sailing)} />}
        {quote.data && <LandHolidayCompare sailing={sailing} total={quote.data.total} guests={guests} />}
        <Card info><p>{t('discover.estimateNote')}</p></Card>
        <p><Link to="/home/cruise/cost">{t('cost.link')}</Link> · <Link to="/home/cabins">{t('route.cabins')}</Link> · <Link to="/home/decide">{t('route.decide')}</Link></p>
      </section>

      <DayStrip sailing={sailing} />

      <section aria-labelledby="plan-h">
        <h2 id="plan-h">{th('discover.dayByDay')}</h2>
        <ItineraryList sailing={sailing} dated />
      </section>
      <OnThatDate sailing={sailing} />
      <p><Link to="/home/sailings">{t('discover.allDates')}</Link></p>
    </div>
  )
}
