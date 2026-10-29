import { Link } from 'react-router'
import { t } from '../../i18n'
import { sailingRange } from '../../domain/cruise'
import { favouriteKey } from '../../domain/favourites'
import { SAILINGS } from '../../domain/sailings'
import { api } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { useFavourites } from '../../hooks/useFavourites'
import { Card } from '../Card'
import { Button } from '../Button'
import { Bookmark, BookmarkCheck } from '../icons'
import { FromPriceBlock, PriceState } from './parts'

/** The sailing dates with "from" prices (DIS-04 cut down to one cruise, DIS-11). */
export function SailingsScreen() {
  const offers = useAsync(() => api.discover.offers(), [])
  const favourites = useFavourites()
  const lowest = offers.data ? Math.min(...offers.data.map((o) => o.from.fare)) : null
  return (
    <div className="page">
      <h1>{t('route.sailings')}</h1>
      <p>{t('discover.sailingsIntro')}</p>
      <PriceState state={offers}>
        <ul className="card-grid">
          {SAILINGS.map((s) => {
            const offer = offers.data?.find((o) => o.id === s.id)
            const key = favouriteKey('sailing', s.id)
            const saved = favourites.has(key)
            const Icon = saved ? BookmarkCheck : Bookmark
            return (
              <li key={s.id}>
                <Card>
                  <h2 className="card__title"><Link to={`/home/sailings/${s.id}`}>{sailingRange(s)}</Link></h2>
                  <p>
                    {s.holiday && <span className="tag">{t('discover.holiday')}</span>}
                    {offer && lowest !== null && offer.from.fare === lowest && <span className="tag tag--good">{t('discover.lowest')}</span>}
                  </p>
                  {offer && <FromPriceBlock price={offer.from} />}
                  <Button variant="tertiary" aria-pressed={saved} disabled={!favourites.ready} onClick={() => void favourites.toggle(key)}>
                    <Icon aria-hidden="true" />
                    <span>{t('discover.save')}<span className="visually-hidden"> {sailingRange(s)}</span></span>
                  </Button>
                </Card>
              </li>
            )
          })}
        </ul>
      </PriceState>
      <p className="muted" role="status">{favourites.failed ? t('discover.saveFailed') : ''}</p>
    </div>
  )
}
