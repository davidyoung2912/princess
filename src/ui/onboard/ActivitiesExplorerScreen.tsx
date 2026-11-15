import { Link } from 'react-router'
import { itemsIn } from '../../domain/catalogue'
import { t, th } from '../../i18n'
import { Card } from '../Card'
import { ItemList, MyPicks } from '../aboard/common'
import { Parties } from '../aboard/Parties'

/** Activities Explorer: services, meet-ups and parties on board, what the guest has picked, and ways in to the games and groups. */
export function ActivitiesExplorerScreen() {
  return (
    <div className="page">
      <Card hero labelledBy="act-h">
        <h2 id="act-h" className="card__title">{th('actex.title')}</h2>
        <MyPicks groups={['faith']} />
      </Card>
      <section aria-labelledby="act-meetups">
        <h2 id="act-meetups">{th('actex.meetups')}</h2>
        <ItemList items={itemsIn('faith')} />
      </section>
      <Parties />
      <ul className="plain-bullets">
        <li><Link to="/ship/games">{t('actex.games')}</Link></li>
        <li><Link to="/ship/community">{t('actex.more')}</Link></li>
      </ul>
    </div>
  )
}
