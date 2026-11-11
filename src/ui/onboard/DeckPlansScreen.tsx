import { useState } from 'react'
import { Link } from 'react-router'
import { deckPlansFor, SHIP_NAMES, type DeckPlanShip } from '../../deckPlans/deckPlans'
import { t } from '../../i18n'
import { Chip } from '../Chip'
import { DeckPlanViewer } from './DeckPlanViewer'

const SHIPS = Object.keys(SHIP_NAMES) as DeckPlanShip[]

/** Deck plan pictures for Sun, Sky and Sapphire Princess: pick a ship and a deck, then pan and zoom the plan. */
export function DeckPlansScreen() {
  const [ship, setShip] = useState<DeckPlanShip>('sun')
  const plans = deckPlansFor(ship)
  const [deck, setDeck] = useState(plans[0].deck)
  const plan = plans.find((p) => p.deck === deck) ?? plans[0]
  const label = plan.name
    ? t('dv.planNamed', { ship: SHIP_NAMES[ship], deck: plan.deck, name: plan.name })
    : t('dv.plan', { ship: SHIP_NAMES[ship], deck: plan.deck })
  const pickShip = (s: DeckPlanShip) => {
    setShip(s)
    const next = deckPlansFor(s)
    if (!next.some((p) => p.deck === deck)) setDeck(next[0].deck)
  }
  return (
    <div className="page page--wide">
      <p>{t('dv.intro')}</p>
      <div className="chip-row" role="group" aria-label={t('dv.pickShip')}>
        {SHIPS.map((s) => <Chip key={s} pressed={s === ship} onToggle={() => pickShip(s)}>{SHIP_NAMES[s]}</Chip>)}
      </div>
      <div className="chip-row" role="group" aria-label={t('dv.pickDeck')}>
        {plans.slice().reverse().map((p) => (
          <Chip key={p.deck} pressed={p.deck === plan.deck} onToggle={() => setDeck(p.deck)}>{t('map.deckShort', { deck: p.deck })}</Chip>
        ))}
      </div>
      <h2>{plan.name ? t('dv.headingNamed', { deck: plan.deck, name: plan.name }) : t('map.deck', { deck: plan.deck })}</h2>
      <DeckPlanViewer key={plan.src} src={plan.src} label={label} />
      <p className="muted">{t('dv.credit')}</p>
      <p><Link to="/ship/map">{t('route.deckMap')}</Link></p>
    </div>
  )
}
