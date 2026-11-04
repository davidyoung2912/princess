import { Link, useParams } from 'react-router'
import { t, th } from '../../i18n'
import { CATEGORIES, ABOARD_SHIP, SHIP_ACCESSIBILITY, SHIP_HIGHLIGHTS } from '../../domain/ship'
import { browseSailings, shipSailingSummary } from '../../domain/catalogueBrowse'
import { catalogueShips, shipById } from '../../domain/shipCatalogue'
import { useShip, useShipRooms } from '../../hooks/useShipCatalogue'
import { useCatalogue } from '../../hooks/useCatalogue'
import { useFavourites } from '../../hooks/useFavourites'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { SaveShare } from './parts'
import { ShipTerms } from '../delights/Delights'
import { regionName } from './catalogueNames'

const number = new Intl.NumberFormat('en-US')

/**
 * A ship (H10): `/home/ships/:id` for any ship of the catalogue, and `/home/ship` for the ship of the sailing the app is on. Every ship shows its facts and
 * highlights; a ship at `aboard` depth (Sun Princess) also shows its accessibility notes, terms and stateroom types, and a `browse` ship says plainly that the
 * deck plan and rooms are not in the app yet.
 */
export function ShipScreen() {
  const { id } = useParams()
  useCatalogue()
  const current = useShip()
  const ship = id ? shipById(id) : current
  const favourites = useFavourites()
  const browseRooms = useShipRooms(ship && ship.id !== ABOARD_SHIP.id ? ship.id : undefined)
  if (!ship) {
    return (
      <div className="page">
        <Banner kind="warning" title={t('cat.ship.notFound')} action={<LinkButton to="/home/ships" variant="secondary">{t('cat.shipsLink')}</LinkButton>}>
          <p>{t('cat.ship.notFoundBody')}</p>
        </Banner>
      </div>
    )
  }
  const aboard = ship.depth === 'aboard'
  const isSun = ship.id === ABOARD_SHIP.id
  const highlights = ship.highlights.length > 0 ? ship.highlights : isSun ? SHIP_HIGHLIGHTS : []
  const mine = shipSailingSummary(ship.id, browseSailings())
  const others = catalogueShips().filter((s) => s.id !== ship.id)
  return (
    <div className="page">
      <h2>{ship.name}</h2>
      <p>{ship.intro}</p>
      {!aboard && <Card info><p>{t('cat.ship.browseNote', { ship: ship.name })}</p></Card>}
      <SaveShare kind="ship" id={ship.id} name={ship.name} favourites={favourites} />

      {isSun && (
        <>
          <Card info labelledBy="acc-h">
            <h2 id="acc-h">{th('discover.accessibility')}</h2>
            <ul>{SHIP_ACCESSIBILITY.map((x) => <li key={x}>{x}</li>)}</ul>
          </Card>
          <ShipTerms />
        </>
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
      </dl>

      {highlights.length > 0 && (
        <section aria-labelledby="hl-h">
          <h2 id="hl-h">{th('discover.onboard')}</h2>
          <ul className="card-grid">
            {highlights.map((h) => <li key={h.title} className="card"><h3>{h.title}</h3><p>{h.body}</p></li>)}
          </ul>
        </section>
      )}

      {isSun && (
        <section aria-labelledby="rooms-h">
          <h2 id="rooms-h">{th('discover.rooms')}</h2>
          <ul className="card-grid">
            {CATEGORIES.map((c) => (
              <li key={c.id} className="card">
                <h3>{c.name} <span className="muted">({c.code})</span></h3>
                <p>{c.summary}</p>
                <p className="muted">{c.size} · {c.view}</p>
              </li>
            ))}
          </ul>
          <p className="muted">{t('discover.accessibleRooms', { count: ABOARD_SHIP.accessibleStaterooms })}</p>
        </section>
      )}

      {!isSun && (
        <section aria-labelledby="rooms-b-h">
          <h2 id="rooms-b-h">{th('cat.ship.roomsBrowse')}</h2>
          {browseRooms === null
            ? <p role="status" className="muted">{t('cat.ship.roomsLoading')}</p>
            : (
              <ul className="card-grid">
                {browseRooms.map((r) => (
                  <li key={r.id} className="card">
                    <h3>{r.name}</h3>
                    {r.description && <p>{r.description}</p>}
                    <p className="muted">{[r.sizeSqFt > 0 ? t('cat.roomSize', { size: r.sizeSqFt }) : '', t('cat.roomSleeps', { count: r.capacity })].filter(Boolean).join(' · ')}</p>
                  </li>
                ))}
              </ul>
            )}
        </section>
      )}

      <section aria-labelledby="ss-h">
        <h2 id="ss-h">{th('cat.ship.sailings')}</h2>
        {mine.count === 0
          ? <p className="muted">{t('cat.ship.noSailings')}</p>
          : <p>{t('cat.ship.sailingCount', { count: mine.count })}{mine.regions.length > 0 ? ` · ${mine.regions.map(regionName).join(', ')}` : ''}</p>}
        <LinkButton to={`/home/sailings?ship=${ship.id}`} block>{t('cat.ship.seeSailings', { ship: ship.name })}</LinkButton>
      </section>

      {others.length > 0 && (
        <section aria-labelledby="others-h">
          <h2 id="others-h">{th('discover.otherShips')}</h2>
          <ul className="plain-list">
            {others.map((s) => (
              <li key={s.id}>
                <span><Link to={`/home/ships/${s.id}`}><strong>{s.name}</strong></Link> · {s.entered ?? ''} · {t('discover.guestsCount', { n: number.format(s.guests) })}</span>
                <span className="muted"><Link to={`/home/ships/compare?a=${ship.id}&b=${s.id}`}>{t('cat.ship.compareWith', { ship: s.name })}</Link></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
