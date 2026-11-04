import { useSearchParams } from 'react-router'
import stanley from '../../assets/stanley-small.png'
import { requestStanley } from '../../ai/stanleyOpen'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { BackLink } from '../onboard/common'

/** The old assistant screens now start here: Stanley is the one place to ask, so the page says so and opens him, with any words carried in the address already in his box. */
function Door({ introKey, tryKeys }: { introKey: StringKey; tryKeys: readonly StringKey[] }) {
  const [params] = useSearchParams()
  const carried = (params.get('q') ?? '').slice(0, 200)
  return (
    <div className="page">
      <p><img className="stanley__avatar" src={stanley} alt="" width="64" height="64" /> {t(introKey)}</p>
      <Button onClick={() => requestStanley(carried)}>{t('stanley.door.open')}</Button>
      <ul className="plain-bullets" aria-label={t('stanley.door.examples')}>
        {tryKeys.map((k) => <li key={k}><button type="button" className="link-button" onClick={() => requestStanley(t(k))}>{t(k)}</button></li>)}
      </ul>
      <p className="muted">{t('stanley.door.note')}</p>
      <BackLink to="/" label={t('route.home')} />
    </div>
  )
}

/** Before you book (was H04, Ask the Concierge). */
export const BeforeDoor = () => <Door introKey="stanley.door.before" tryKeys={['ai.try.1', 'ai.try.2', 'ai.try.3']} />
/** The ship (was S14, Ask the Ship). */
export const ShipDoor = () => <Door introKey="stanley.door.ship" tryKeys={['stanley.door.ship.1', 'stanley.door.ship.2']} />
