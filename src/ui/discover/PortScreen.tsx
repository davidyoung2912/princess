import { Link, useParams } from 'react-router'
import { t, type StringKey } from '../../i18n'
import { portGuideById } from '../../domain/ports'
import { formatMoney } from '../../domain/pricing'
import { PORTS, REFERENCE_SAILING, itinerary } from '../../domain/sailings'
import { useFavourites } from '../../hooks/useFavourites'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { Anchor } from '../icons'
import { SaveShare } from './parts'

/** A port guide: how you get ashore and how accessible it is come first, then things to do and sample excursions (DIS-05). */
export function PortScreen() {
  const { id } = useParams()
  const guide = portGuideById(id)
  const favourites = useFavourites()
  if (!guide) {
    return (
      <div className="page">
        <h1>{t('route.port')}</h1>
        <Banner kind="warning" title={t('discover.notFound.port')} action={<LinkButton to="/home/cruise" variant="secondary">{t('discover.seePlan')}</LinkButton>}>
          <p>{t('discover.notFound.body')}</p>
        </Banner>
      </div>
    )
  }
  const name = PORTS[guide.id].name
  const day = itinerary(REFERENCE_SAILING).find((d) => d.port === guide.id)
  const tender = guide.landing === 'tender'
  return (
    <div className="page">
      <h1>{name}</h1>
      <p><span className={`tag${tender ? ' tag--alert' : ''}`}><Anchor aria-hidden="true" /> {tender ? t('discover.tender') : t('discover.dock')}</span>{day && <> <span className="muted">{t('discover.visitedDay', { day: day.day })}</span></>}</p>
      <SaveShare kind="port" id={guide.id} name={name} favourites={favourites} />

      <section aria-labelledby="access-h">
        <Card info labelledBy="access-h">
          <h2 id="access-h">{t('discover.gettingAshore')}</h2>
          <p>{guide.access}</p>
        </Card>
      </section>

      <p>{guide.blurb}</p>
      <p><strong>{t('discover.bestTime')}</strong> {guide.bestTime}</p>

      <section aria-labelledby="do-h">
        <h2 id="do-h">{t('discover.thingsToDo')}</h2>
        <ul>{guide.doThis.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>

      {guide.excursions.length > 0 && (
        <section aria-labelledby="exc-h">
          <h2 id="exc-h">{t('discover.excursions')}</h2>
          <p className="muted">{t('discover.excursionsNote')}</p>
          <ul className="card-grid">
            {guide.excursions.map((e) => (
              <li key={e.id} className="card">
                <h3>{e.name}</h3>
                <p>{t('discover.hours', { hours: e.hours })} · {t('discover.fromPrice', { price: formatMoney(e.price * 100) })}</p>
                <p className="muted">{t(`discover.effort.${e.access}` as StringKey)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p><Link to="/home/cruise">{t('discover.backToCruise')}</Link></p>
    </div>
  )
}
