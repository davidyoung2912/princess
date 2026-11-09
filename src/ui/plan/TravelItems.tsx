import { travelItems, type TravelPlan } from '../../domain/travel'
import { t, th, type StringKey } from '../../i18n'
import { Card } from '../Card'

/** What the guest has arranged to get to the port (MNG-09): provider, contact, timing and a plan if it goes wrong. Arrangements with other companies say so. */
export function TravelItems({ plan }: { plan: TravelPlan }) {
  const items = travelItems(plan)
  if (items.length === 0) return null
  return (
    <Card labelledBy="ti-h">
      <h2 id="ti-h" className="card__title">{th('travelItems.title')}</h2>
      <ul className="card-grid">
        {items.map((i) => (
          <li key={i.id}>
            <h3 className="card__title">{i.provider}</h3>
            <p className="muted">{t(i.external ? 'travelItems.external' : 'travelItems.princess')}</p>
            <dl className="summary">
              {(['contact', 'timing', 'ifDisrupted'] as const).map((k) => <div key={k} className="summary__row"><dt>{t(`travelItems.${k}` as StringKey)}</dt><dd>{i[k]}</dd></div>)}
            </dl>
          </li>
        ))}
      </ul>
      <p className="muted">{t('travelItems.reference')}</p>
    </Card>
  )
}
