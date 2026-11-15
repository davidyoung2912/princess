import { Link } from 'react-router'
import { itemsIn } from '../../domain/catalogue'
import { t, th } from '../../i18n'
import { Card } from '../Card'
import { ItemList, MyPicks } from '../aboard/common'

/** Exercise Explorer: the fitness classes and training to book, what the guest has picked, and a way to the full spa and fitness page. */
export function ExerciseExplorerScreen() {
  return (
    <div className="page">
      <Card hero labelledBy="exx-h">
        <h2 id="exx-h" className="card__title">{th('exex.title')}</h2>
        <MyPicks groups={['fitness']} />
      </Card>
      <section aria-labelledby="exx-classes">
        <h2 id="exx-classes">{th('exex.classes')}</h2>
        <ItemList items={itemsIn('fitness')} />
      </section>
      <p><Link to="/ship/spa">{t('exex.browse')}</Link></p>
    </div>
  )
}
