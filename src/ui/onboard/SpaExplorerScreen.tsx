import { Link } from 'react-router'
import { itemsIn } from '../../domain/catalogue'
import { t, th } from '../../i18n'
import { Card } from '../Card'
import { ItemList, MyPicks } from '../aboard/common'

/** Spa Explorer: the spa and salon treatments to book, what the guest has picked, and a way to the full spa and fitness page. */
export function SpaExplorerScreen() {
  return (
    <div className="page">
      <Card hero labelledBy="spx-h">
        <h2 id="spx-h" className="card__title">{th('spaexp.title')}</h2>
        <MyPicks groups={['spa']} />
      </Card>
      <section aria-labelledby="spx-treatments">
        <h2 id="spx-treatments">{th('spaexp.treatments')}</h2>
        <ItemList items={itemsIn('spa')} />
      </section>
      <p><Link to="/ship/spa">{t('spaexp.browse')}</Link></p>
    </div>
  )
}
