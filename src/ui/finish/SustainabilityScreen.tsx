import { useShip } from '../../hooks/useShipCatalogue'
import { ABOARD_SHIP } from '../../domain/ship'
import { SUSTAINABILITY } from '../../domain/postcruise'
import { t, th, type StringKey } from '../../i18n'
import { CarbonCard } from '../plan/PrepMoreScreens'
import { Card } from '../Card'
import { BackLink } from '../onboard/common'

/** Caring for the sea (POS-12): the cruise's distance and fuel, what the ship does, and what a guest can do. Concept figures, to be checked before real use. */
export function SustainabilityScreen() {
  const onSun = useShip().id === ABOARD_SHIP.id
  return (
    <div className="page">
      <p>{t('sus.intro')}</p>
      <Card labelledBy="sus-trip-h">
        <h2 id="sus-trip-h" className="card__title">{th('sus.trip')}</h2>
        {SUSTAINABILITY.nauticalMiles > 0 && <p>{t('sus.miles', { miles: SUSTAINABILITY.nauticalMiles.toLocaleString('en-US') })}</p>}
        {onSun ? <p>{t(`sus.fuel.${SUSTAINABILITY.fuel}` as StringKey)}</p> : SUSTAINABILITY.nauticalMiles === 0 && <p>{t('sus.tripOther')}</p>}
      </Card>
      <CarbonCard />
      <Card labelledBy="sus-ship-h">
        <h2 id="sus-ship-h" className="card__title">{th('sus.ship')}</h2>
        <ul className="plain-bullets">{SUSTAINABILITY.programmes.map((p) => <li key={p}>{t(`sus.prog.${p}` as StringKey)}</li>)}</ul>
      </Card>
      <Card labelledBy="sus-you-h">
        <h2 id="sus-you-h" className="card__title">{th('sus.you')}</h2>
        <ul className="plain-bullets">{SUSTAINABILITY.tips.map((p) => <li key={p}>{t(`sus.tip.${p}` as StringKey)}</li>)}</ul>
      </Card>
      <p className="muted">{t('sus.verify')}</p>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}
