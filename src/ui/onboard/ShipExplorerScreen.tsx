import { Link } from 'react-router'
import { CATEGORIES, SUN_SHIP, SHIP_ACCESSIBILITY, SHIP_HIGHLIGHTS } from '../../domain/ship'
import { SHIP_NAMES, type DeckPlanShip } from '../../deckPlans/deckPlans'
import { useShip } from '../../hooks/useShipCatalogue'
import { headingCase, t, th } from '../../i18n'
import { Card } from '../Card'
import { LinkButton } from '../Button'

const number = new Intl.NumberFormat('en-US')

/** Ship Explorer: the guest's ship in detail (facts, highlights, accessibility, stateroom types) with the deck plans below. */
export function ShipExplorerScreen() {
  const ship = useShip()
  const isSun = ship.id === SUN_SHIP.id
  const first = ship.id.split('-')[0]
  const plansFor: DeckPlanShip | undefined = first in SHIP_NAMES ? (first as DeckPlanShip) : undefined
  const highlights = ship.highlights.length > 0 ? ship.highlights : isSun ? SHIP_HIGHLIGHTS : []
  return (
    <div className="page page--wide">
      {ship.id === '' ? <p>{t('shipex.noShip')}</p> : (
        <>
          <h2>{ship.name}</h2>
          <p>{ship.intro}</p>
          {isSun && (
            <Card info labelledBy="sx-acc">
              <h2 id="sx-acc">{th('discover.accessibility')}</h2>
              <ul>{SHIP_ACCESSIBILITY.map((x) => <li key={x}>{x}</li>)}</ul>
            </Card>
          )}
          <dl className="facts">
            <div><dt>{t('discover.ship.class')}</dt><dd>{ship.className}</dd></div>
            {ship.entered !== undefined && <div><dt>{t('discover.ship.entered')}</dt><dd>{ship.entered}</dd></div>}
            <div><dt>{t('discover.ship.guests')}</dt><dd>{number.format(ship.guests)}</dd></div>
            {ship.crew !== undefined && <div><dt>{t('discover.ship.crew')}</dt><dd>{number.format(ship.crew)}</dd></div>}
            {ship.staterooms !== undefined && <div><dt>{t('discover.ship.staterooms')}</dt><dd>{number.format(ship.staterooms)}</dd></div>}
            <div><dt>{t('discover.ship.decks')}</dt><dd>{ship.decks}</dd></div>
            <div><dt>{t('cat.fact.tonnage')}</dt><dd>{number.format(ship.tonnage)}</dd></div>
            {ship.lengthFt !== undefined && <div><dt>{t('cat.fact.lengthFt')}</dt><dd>{number.format(ship.lengthFt)} ft</dd></div>}
            {ship.facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
          </dl>
          {highlights.length > 0 && (
            <section aria-labelledby="sx-hl">
              <h2 id="sx-hl">{th('discover.onboard')}</h2>
              <ul className="card-grid">
                {highlights.map((h) => <li key={h.title} className="card"><h3>{h.title}</h3><p>{h.body}</p></li>)}
              </ul>
            </section>
          )}
          {ship.sections.map((sec) => (
            <details key={sec.title} className="card ship-section" open={sec.open}>
              <summary><h2 className="ship-section__title">{headingCase(sec.title)}</h2></summary>
              <ul className="plain-bullets">
                {sec.items.map((i) => <li key={`${i.title ?? ''}${i.body}`}>{i.title && <strong>{i.title}. </strong>}{i.body}</li>)}
              </ul>
            </details>
          ))}
          {isSun && (
            <section aria-labelledby="sx-rooms">
              <h2 id="sx-rooms">{th('discover.rooms')}</h2>
              <ul className="card-grid">
                {CATEGORIES.map((c) => (
                  <li key={c.id} className="card">
                    <h3>{c.name} <span className="muted">({c.code})</span></h3>
                    <p>{c.summary}</p>
                    <p className="muted">{c.size} · {c.view}</p>
                  </li>
                ))}
              </ul>
              <p className="muted">{t('discover.accessibleRooms', { count: SUN_SHIP.accessibleStaterooms })}</p>
            </section>
          )}
        </>
      )}
      <p><LinkButton to={plansFor ? `/deck-plans?ship=${plansFor}` : '/deck-plans'} variant="secondary">{th('shipex.deckPlans')}</LinkButton></p>
      <p><Link to="/ship/venues">{t('shipex.venues')}</Link></p>
    </div>
  )
}
