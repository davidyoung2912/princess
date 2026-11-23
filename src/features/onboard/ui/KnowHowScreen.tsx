import { Link } from 'react-router'
import { topicsFor } from '../../../domain/knowHow'
import { useJourneyStage } from '../../../shared/hooks/useJourneyStage'
import { t, th, type StringKey } from '../../../shared/i18n'
import { Card } from '../../../shared/ui/Card'
import { BackLink } from './common'

/** Cruise know-how (S51): plain tips on what to wear, the ship's rules, money aboard, crew words, sea days, drink packages, insurance and tender ports. The topics that matter at this stage come first. */
export function KnowHowScreen() {
  const stage = useJourneyStage()
  // The page opens at every stage; the Ship tab exists only once the trip is near, so earlier stages go back Home.
  const onShipTab = ['prebook', 'getToShip', 'embark', 'sea', 'port', 'disembark', 'remember'].includes(stage)
  return (
    <div className="page">
      <BackLink to={onShipTab ? '/ship' : '/'} label={t(onShipTab ? 'route.ship' : 'route.home')} />
      <p>{t('knowhow.intro')}</p>
      {topicsFor(stage).map((topic) => {
        return (
          <Card key={topic.id} labelledBy={`kh-${topic.id}`}>
            <h2 id={`kh-${topic.id}`} className="card__title">{th(topic.title as StringKey)}</h2>
            <ul>{topic.tips.map((key) => <li key={key}>{t(key as StringKey)}</li>)}</ul>
            <p><Link to={topic.link}>{t(topic.text as StringKey)}</Link></p>
          </Card>
        )
      })}
      <p className="muted">{t('knowhow.footer')}</p>
    </div>
  )
}
