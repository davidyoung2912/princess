import { Link } from 'react-router'
import { itemsIn } from '../../domain/catalogue'
import { t, th } from '../../i18n'
import { Card } from '../Card'
import { ItemList, MyPicks } from '../aboard/common'

/** Shopping today: what the guest has picked in the shops, today's auctions, events and specials, and a way to the full shops page. */
export function ShoppingTodayScreen() {
  return (
    <div className="page">
      <Card hero labelledBy="st-h">
        <h2 id="st-h" className="card__title">{th('stoday.title')}</h2>
        <MyPicks groups={['shop', 'special']} />
      </Card>
      <section aria-labelledby="st-specials">
        <h2 id="st-specials">{th('shops.specials')}</h2>
        <ItemList items={itemsIn('special')} />
      </section>
      <p><Link to="/ship/shops">{t('stoday.browse')}</Link></p>
    </div>
  )
}
