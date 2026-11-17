import { CATEGORIES, SUN_SHIP, SHIP_ACCESSIBILITY, SHIP_HIGHLIGHTS } from '../../domain/ship'
import { SHIP_NAMES, type DeckPlanShip } from '../../deckPlans/deckPlans'
import { useShip } from '../../hooks/useShipCatalogue'
import { headingCase, t, th } from '../../i18n'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { Shortlist } from '../explorer/Shortlist'
import { ExplorerTiles } from '../explorer/ExplorerTiles'

const number = new Intl.NumberFormat('en-US')

/** Ship Explorer: the guest's ship in detail (facts, highlights, the detail sections and stateroom types), with a link to the deck plans and the accessibility summary at the end. */
export function ShipExplorerScreen() {
  const ship = useShip()
  const isSun = ship.id === SUN_SHIP.id
  const first = ship.id.split('-')[0]
  const plansFor: DeckPlanShip | undefined = first in SHIP_NAMES ? (first as DeckPlanShip) : undefined
  const highlights = ship.highlights.length > 0 ? ship.highlights : isSun ? SHIP_HIGHLIGHTS : []
  const parts = [
    ...(highlights.length > 0 ? [{ id: 'sx-hl', title: th('discover.onboard') }] : []),
    ...ship.sections.map((sec, i) => ({ id: `sx-s${i}`, title: headingCase(sec.title) })),
    ...(isSun ? [{ id: 'sx-rooms', title: th('discover.rooms') }, { id: 'sx-acc', title: th('discover.accessibility') }] : []),
  ]
  return (
    <div className="page page--wide">
      {ship.id === '' ? <p>{t('shipex.noShip')}</p> : (
        <>
          <h2>{ship.name}</h2>
          <p>{ship.intro}</p>
          <p className="button-row">
            <LinkButton to="/ship/venues" variant="secondary">{th('shipex.venues')}</LinkButton>{' '}
            <LinkButton to={plansFor ? `/deck-plans?ship=${plansFor}` : '/deck-plans'} variant="secondary">{th('shipex.deckPlans')}</LinkButton>
          </p>
          <ExplorerTiles />
          <Shortlist />
          <nav aria-label={t('shipex.jump')}>
            <ul className="naut-jump">
              {parts.map((x) => <li key={x.id}><a href={`#${x.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(x.id)?.scrollIntoView({ block: 'start' }); document.getElementById(x.id)?.focus() }}>{x.title}</a></li>)}
            </ul>
          </nav>
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
            <section id="sx-hl" tabIndex={-1} aria-labelledby="sx-hl-h">
              <h2 id="sx-hl-h">{th('discover.onboard')}</h2>
              <ul className="card-grid">
                {highlights.map((h) => <li key={h.title} className="card"><h3>{h.title}</h3><p>{h.body}</p></li>)}
              </ul>
            </section>
          )}
          {ship.sections.map((sec, i) => (
            <section key={sec.title} id={`sx-s${i}`} tabIndex={-1} aria-labelledby={`sx-s${i}-h`}>
              <h2 id={`sx-s${i}-h`}>{headingCase(sec.title)}</h2>
              <ul className="plain-bullets">
                {sec.items.map((it) => <li key={`${it.title ?? ''}${it.body}`}>{it.title && <strong>{it.title}. </strong>}{it.body}</li>)}
              </ul>
            </section>
          ))}
          {isSun && (
            <section id="sx-rooms" tabIndex={-1} aria-labelledby="sx-rooms-h">
              <h2 id="sx-rooms-h">{th('discover.rooms')}</h2>
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
          {isSun && (
            <div id="sx-acc" tabIndex={-1}>
            <Card info labelledBy="sx-acc-h">
              <h2 id="sx-acc-h">{th('discover.accessibility')}</h2>
              <ul>{SHIP_ACCESSIBILITY.map((x) => <li key={x}>{x}</li>)}</ul>
            </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
