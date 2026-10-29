import { t } from '../../i18n'
import { CATEGORIES, OTHER_SHIPS, SHIP, SHIP_ACCESSIBILITY, SHIP_HIGHLIGHTS } from '../../domain/ship'
import { useFavourites } from '../../hooks/useFavourites'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { SaveShare } from './parts'

const number = new Intl.NumberFormat('en-US')

/** The ship (DIS-03, cut down to one ship and a teaser of others, requirements §22.4). */
export function ShipScreen() {
  const favourites = useFavourites()
  return (
    <div className="page">
      <h1>{SHIP.name}</h1>
      <p>{SHIP.intro}</p>
      <SaveShare kind="ship" id={SHIP.id} name={SHIP.name} favourites={favourites} />

      <Card info labelledBy="acc-h">
        <h2 id="acc-h">{t('discover.accessibility')}</h2>
        <ul>{SHIP_ACCESSIBILITY.map((x) => <li key={x}>{x}</li>)}</ul>
      </Card>

      <dl className="facts">
        <div><dt>{t('discover.ship.class')}</dt><dd>{SHIP.className}</dd></div>
        <div><dt>{t('discover.ship.entered')}</dt><dd>{SHIP.entered}</dd></div>
        <div><dt>{t('discover.ship.guests')}</dt><dd>{number.format(SHIP.guests)}</dd></div>
        <div><dt>{t('discover.ship.crew')}</dt><dd>{number.format(SHIP.crew)}</dd></div>
        <div><dt>{t('discover.ship.staterooms')}</dt><dd>{number.format(SHIP.staterooms)}</dd></div>
        <div><dt>{t('discover.ship.decks')}</dt><dd>{SHIP.decks}</dd></div>
      </dl>

      <section aria-labelledby="hl-h">
        <h2 id="hl-h">{t('discover.onboard')}</h2>
        <ul className="card-grid">
          {SHIP_HIGHLIGHTS.map((h) => <li key={h.title} className="card"><h3>{h.title}</h3><p>{h.body}</p></li>)}
        </ul>
      </section>

      <section aria-labelledby="rooms-h">
        <h2 id="rooms-h">{t('discover.rooms')}</h2>
        <ul className="card-grid">
          {CATEGORIES.map((c) => (
            <li key={c.id} className="card">
              <h3>{c.name} <span className="muted">({c.code})</span></h3>
              <p>{c.summary}</p>
              <p className="muted">{c.size} · {c.view}</p>
            </li>
          ))}
        </ul>
        <p className="muted">{t('discover.accessibleRooms', { count: SHIP.accessibleStaterooms })}</p>
      </section>

      <section aria-labelledby="others-h">
        <h2 id="others-h">{t('discover.otherShips')}</h2>
        <p className="muted">{t('discover.otherShipsNote')}</p>
        <ul className="plain-list">
          {OTHER_SHIPS.map((s) => <li key={s.name}><span><strong>{s.name}</strong> · {s.entered} · {t('discover.guestsCount', { n: number.format(s.guests) })}</span><span className="muted">{s.note}</span></li>)}
        </ul>
      </section>
      <LinkButton to="/home/sailings" block>{t('discover.seeDates')}</LinkButton>
    </div>
  )
}
