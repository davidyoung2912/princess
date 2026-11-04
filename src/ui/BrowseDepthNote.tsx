import { useLocation } from 'react-router'
import { aboardFeatureAt, hasDepthFor } from '../domain/aboardDepth'
import { t, type StringKey } from '../i18n'
import { useShip } from '../hooks/useShipCatalogue'
import { Banner } from './Banner'
import { LinkButton } from './Button'

/** Above a screen that needs a ship's deck plan, cabins, venues or muster stations: says plainly when the sailing's ship is not in the app at that depth yet, and offers the ship's page. */
export function BrowseDepthNote() {
  const { pathname } = useLocation()
  const ship = useShip()
  const feature = aboardFeatureAt(pathname)
  if (!feature || hasDepthFor(ship.depth) || !ship.id) return null
  return (
    <Banner kind="info" title={t(`depth.${feature}.title` as StringKey, { ship: ship.name })} action={<LinkButton to={`/home/ships/${ship.id}`} variant="secondary">{t('depth.seeShip', { ship: ship.name })}</LinkButton>}>
      <p>{t(`depth.${feature}.body` as StringKey, { ship: ship.name })}</p>
    </Banner>
  )
}
