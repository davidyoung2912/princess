import { SUSTAINABILITY } from '../../domain/postcruise'
import { t, type StringKey } from '../../i18n'
import { Card } from '../Card'
import { BackLink } from '../onboard/common'

/** Caring for the sea (POS-12): the cruise's distance and fuel, what the ship does, and what a guest can do. Concept figures, to be checked before real use. */
export function SustainabilityScreen() {
  return (
    <div className="page">
      <h1>{t('route.sustainability')}</h1>
      <p>{t('sus.intro')}</p>
      <Card labelledBy="sus-trip-h">
        <h2 id="sus-trip-h" className="card__title">{t('sus.trip')}</h2>
        <p>{t('sus.miles', { miles: SUSTAINABILITY.nauticalMiles.toLocaleString('en-US') })}</p>
        <p>{t(`sus.fuel.${SUSTAINABILITY.fuel}` as StringKey)}</p>
      </Card>
      <Card labelledBy="sus-ship-h">
        <h2 id="sus-ship-h" className="card__title">{t('sus.ship')}</h2>
        <ul className="plain-bullets">{SUSTAINABILITY.programmes.map((p) => <li key={p}>{t(`sus.prog.${p}` as StringKey)}</li>)}</ul>
      </Card>
      <Card labelledBy="sus-you-h">
        <h2 id="sus-you-h" className="card__title">{t('sus.you')}</h2>
        <ul className="plain-bullets">{SUSTAINABILITY.tips.map((p) => <li key={p}>{t(`sus.tip.${p}` as StringKey)}</li>)}</ul>
      </Card>
      <p className="muted">{t('sus.verify')}</p>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}
