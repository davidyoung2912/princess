import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { spotFromQuery } from '../../domain/explorer/navigate'
import { findCabin, type CabinLocation } from '../../deckPlans/cabinFinder'
import { deckPlansFor, SHIP_NAMES, type DeckPlanShip } from '../../deckPlans/deckPlans'
import { useShip } from '../../hooks/useShipCatalogue'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { DeckPlanViewer } from './DeckPlanViewer'

const SHIPS = Object.keys(SHIP_NAMES) as DeckPlanShip[]

type Search = { kind: 'none' } | { kind: 'missing'; query: string } | { kind: 'found'; at: CabinLocation }

/** Deck plan pictures for Sun, Sky and Sapphire Princess: find a cabin, or pick a ship and a deck, then pan and zoom the plan. */
export function DeckPlansScreen() {
  const ship = useShip()
  const first = ship.id.split('-')[0]
  return (
    <div className="page page--wide">
      <DeckPlansPanel initialShip={first in SHIP_NAMES ? (first as DeckPlanShip) : undefined} />
    </div>
  )
}

/** The deck plan picker and viewer: opens on the ship in the link (`?ship=`), else the guest's own ship. */
export function DeckPlansPanel({ initialShip = 'sun' }: { initialShip?: DeckPlanShip }) {
  const [params] = useSearchParams()
  const target = spotFromQuery(params)
  const asked = params.get('ship') as DeckPlanShip | null
  const [ship, setShip] = useState<DeckPlanShip>(asked && SHIPS.includes(asked) ? asked : initialShip)
  const plans = deckPlansFor(ship)
  const [deck, setDeck] = useState(target && plans.some((p) => p.deck === target.deck) ? target.deck : plans[0].deck)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<Search>({ kind: 'none' })
  const plan = plans.find((p) => p.deck === deck) ?? plans[0]
  const label = plan.name
    ? t('dv.planNamed', { ship: SHIP_NAMES[ship], deck: plan.deck, name: plan.name })
    : t('dv.plan', { ship: SHIP_NAMES[ship], deck: plan.deck })
  const pickShip = (s: DeckPlanShip) => {
    setShip(s)
    const next = deckPlansFor(s)
    if (!next.some((p) => p.deck === deck)) setDeck(next[0].deck)
  }
  const find = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim() === '') return setSearch({ kind: 'none' })
    const at = findCabin(query, ship)
    if (!at) return setSearch({ kind: 'missing', query: query.trim() })
    setShip(at.ship)
    setDeck(at.deck)
    setSearch({ kind: 'found', at })
  }
  const found = search.kind === 'found' ? search.at : null
  const pin = found && found.ship === ship && found.deck === plan.deck ? { x: found.x, y: found.y } : undefined
  return (
    <>
      <p>{t('dv.intro')}</p>
      {target && <p role="status">{t('exp.nav.noteMap', { title: target.label, deck: target.deck, section: t(`map.section.${target.section}` as StringKey).toLowerCase() })}</p>}
      <form onSubmit={find} className="deckfind">
        <div className="field">
          <label htmlFor="deck-cabin">{t('dv.cabinLabel')}</label>
          <p className="field__hint" id="deck-cabin-hint">{t('dv.cabinHint')}</p>
          <div className="deckfind__row">
            <input
              id="deck-cabin"
              type="search"
              className="field__input"
              value={query}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-describedby="deck-cabin-hint"
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit">{t('dv.cabinFind')}</Button>
          </div>
        </div>
        <p role="status" className="deckfind__result">
          {found && t('dv.cabinFound', {
            cabin: found.cabin,
            ship: SHIP_NAMES[found.ship],
            deck: found.deck,
            side: t(`dv.side.${found.side}` as StringKey),
            end: t(`dv.end.${found.end}` as StringKey),
          })}
          {found?.estimated && ` ${t('dv.cabinEstimated')}`}
          {search.kind === 'missing' && t('dv.cabinMissing', { cabin: search.query })}
        </p>
      </form>
      <div className="chip-row" role="group" aria-label={t('dv.pickShip')}>
        {SHIPS.map((s) => <Chip key={s} pressed={s === ship} onToggle={() => pickShip(s)}>{SHIP_NAMES[s]}</Chip>)}
      </div>
      <div className="chip-row" role="group" aria-label={t('dv.pickDeck')}>
        {plans.slice().reverse().map((p) => (
          <Chip key={p.deck} pressed={p.deck === plan.deck} onToggle={() => setDeck(p.deck)}>{t('map.deckShort', { deck: p.deck })}</Chip>
        ))}
      </div>
      <h2>{plan.name ? t('dv.headingNamed', { deck: plan.deck, name: plan.name }) : t('map.deck', { deck: plan.deck })}</h2>
      <DeckPlanViewer key={plan.src} src={plan.src} label={label} pin={pin} />
      <p className="muted">{t('dv.credit')}</p>
      <p><Link to="/ship/map">{t('route.deckMap')}</Link></p>
    </>
  )
}
