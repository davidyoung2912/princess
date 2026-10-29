import { itemsIn } from '../../domain/catalogue'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Back, ItemList, MyPicks } from './common'
import { Parties } from './Parties'

/** Spa, salon and fitness (ENT-03): book treatments and classes, with the day's price and places left. */
export function SpaScreen() {
  return (
    <div className="page">
      <h1>{t('route.spa')}</h1>
      <p>{t('spa.intro')}</p>
      <MyPicks groups={['spa', 'fitness']} />
      <h2>{t('spa.treatments')}</h2>
      <ItemList items={itemsIn('spa')} />
      <h2>{t('spa.fitness')}</h2>
      <ItemList items={itemsIn('fitness')} />
      <Banner kind="info" title={t('spa.products')}><p>{t('spa.productsBody')}</p></Banner>
      <Back to="/ship" label={t('route.ship')} />
    </div>
  )
}

/** Shops, gift cards, auctions and daily specials (SHP-01, SHP-04): pre-order for pickup, or mark what you would like to go to. */
export function ShopsScreen() {
  return (
    <div className="page">
      <h1>{t('route.shops')}</h1>
      <p>{t('shops.intro')}</p>
      <MyPicks groups={['shop', 'special']} />
      <h2>{t('shops.goods')}</h2>
      <ItemList items={itemsIn('shop').filter((i) => !i.id.startsWith('gift-'))} />
      <h2>{t('shops.gifts')}</h2>
      <p>{t('shops.giftsBody')}</p>
      <ItemList items={itemsIn('shop').filter((i) => i.id.startsWith('gift-'))} />
      <h2>{t('shops.specials')}</h2>
      <ItemList items={itemsIn('special')} />
      <Back to="/ship" label={t('route.ship')} />
    </div>
  )
}

/** Faith and community services, meet-ups and cabin parties (SHP-06, ROM-06). */
export function CommunityScreen() {
  return (
    <div className="page">
      <h1>{t('route.community')}</h1>
      <p>{t('comm.intro')}</p>
      <MyPicks groups={['faith']} />
      <ItemList items={itemsIn('faith')} />
      <Parties />
      <Back to="/ship" label={t('route.ship')} />
    </div>
  )
}

/** Captioned and signed showings (ACS-04). */
export function AccessScreen() {
  return (
    <div className="page">
      <h1>{t('route.access')}</h1>
      <p>{t('acc.intro')}</p>
      <MyPicks groups={['access']} />
      <ItemList items={itemsIn('access')} />
      <p className="muted">{t('acc.ask')}</p>
      <Back to="/ship" label={t('route.ship')} />
    </div>
  )
}
