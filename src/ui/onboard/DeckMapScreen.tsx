import { useCatalogue } from '../../hooks/useCatalogue'
import { useState } from 'react'
import { DECKS, ELEVATORS, elevatorsNear, MUSTER_STATIONS, placeById, placesOnDeck, searchPlaces, type Place, type Section } from '../../domain/deck'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { BackLink } from './common'
import { DeckPlan } from './DeckPlan'
import { DeckElevation } from './DeckElevation'
import { RouteFinder } from './RouteFinder'
import { CodeScanner } from './DeviceTools'
import { ShipLiteracy } from './ShipLiteracy'
import { ParkMySpot } from '../delights/SeaDelights'
import { DECK_CATEGORIES, inCategories, walkMinutes, type DeckCategory } from '../../domain/deckFilter'
import { useMemory } from '../../hooks/useMemory'

const SECTIONS: readonly Section[] = ['forward', 'midship', 'aft']

/**
 * The deck plan (OB-04): search, then each deck as a table of forward, midship and aft, with elevators, muster stations and step-free marks.
 * The graphic plan (N5.1) sits above the table; both come from the same data. There is no location sensor: "you are here" is shown only when the guest says where they are.
 */
export function DeckMapScreen() {
  useCatalogue()
  const [query, setQuery] = useState('')
  const [deck, setDeck] = useState(7)
  const [stepFree, setStepFree] = useState(false)
  const [quiet, setQuiet] = useState(false)
  const [categories, setCategories] = useState<ReadonlySet<DeckCategory>>(new Set())
  const toggleCategory = (c: DeckCategory) => setCategories((s) => { const n = new Set(s); if (!n.delete(c)) n.add(c); return n })
  const [hereId, setHereId] = useState('')
  const here = placeById(hereId) ?? null
  const parked = useMemory().state.sea.spot
  const pin = (parked && placeById(parked.placeId)) || null
  const found = searchPlaces(query).filter((p) => (!stepFree || p.stepFree) && inCategories(p, categories))
  const onDeck = placesOnDeck(deck).filter((p) => (!stepFree || p.stepFree) && inCategories(p, categories))
  return (
    <div className="page page--wide">
      <Banner kind="info" title={t('map.noLocation')}><p>{t('map.noLocationBody')}</p></Banner>

      <RouteFinder />
      <ShipLiteracy />
      <ParkMySpot />
      <CodeScanner />

      <div className="workspace workspace--map">
      <div className="workspace__side">
      <div className="field">
        <label htmlFor="map-search">{t('map.search')}</label>
        <p className="field__hint">{t('map.searchHint')}</p>
        <input id="map-search" type="search" className="field__input" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="chip-row">
        <Chip pressed={stepFree} onToggle={() => setStepFree(!stepFree)}>{t('map.stepFree')}</Chip>
        <Chip pressed={quiet} onToggle={() => setQuiet(!quiet)}>{t('plan2.quietLayer')}</Chip>
      </div>
      <div className="chip-row" role="group" aria-label={t('l7.cats')}>
        {DECK_CATEGORIES.map((c) => <Chip key={c} pressed={categories.has(c)} onToggle={() => toggleCategory(c)}>{t(`l7.cat.${c}` as StringKey)}</Chip>)}
      </div>
      <div className="field">
        <label htmlFor="map-here">{t('plan2.hereLabel')}</label>
        <p className="field__hint">{t('plan2.hereHint')}</p>
        <select id="map-here" className="field__input" value={hereId} onChange={(e) => { setHereId(e.target.value); const p = placeById(e.target.value); if (p) setDeck(p.deck) }}>
          <option value="">{t('plan2.hereNone')}</option>
          {DECKS.slice().reverse().map((d) => <optgroup key={d} label={t('map.deck', { deck: d })}>{placesOnDeck(d).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>)}
        </select>
      </div>

      </div>
      <div className="workspace__main">
      {query.trim() !== '' && (
        <section aria-labelledby="found-h">
          <h2 id="found-h">{th('map.results')}</h2>
          <p role="status">{t('map.found', { count: found.length })}</p>
          <ul className="plain-bullets">{found.map((p) => <li key={p.id}><PlaceLine p={p} from={here} stepFree={stepFree} /></li>)}</ul>
        </section>
      )}

      <section aria-labelledby="deck-h">
        <h2 id="deck-h">{th('map.deck', { deck })}</h2>
        <div className="chip-row" role="group" aria-label={t('map.pickDeck')}>
          {DECKS.map((d) => <Chip key={d} pressed={d === deck} onToggle={() => setDeck(d)}>{t('map.deckShort', { deck: d })}</Chip>)}
        </div>
        <div className="deck-map__view">
          <DeckElevation deck={deck} onPick={setDeck} />
          <DeckPlan deck={deck} stepFree={stepFree} quiet={quiet} here={here} pin={pin} categories={categories} />
        </div>
        <div className="table-wrap">
          <table className="deck-table">
            <caption>{t('map.deck', { deck })}</caption>
            <thead><tr>{SECTIONS.map((s) => <th key={s} scope="col">{t(`map.section.${s}` as StringKey)}</th>)}</tr></thead>
            <tbody>
              <tr>
                {SECTIONS.map((s) => (
                  <td key={s}>
                    {onDeck.filter((p) => p.section === s).length === 0 ? <span className="muted">{t('map.empty')}</span> : (
                      <ul className="plain-bullets">{onDeck.filter((p) => p.section === s).map((p) => <li key={p.id}>{p.name}{!p.stepFree && ` (${t('onb.notStepFree')})`}{p.note ? <small className="muted"><br />{p.note}</small> : null}</li>)}</ul>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                {SECTIONS.map((s) => <td key={s}><span className="muted">{t('map.lifts')}</span> {ELEVATORS.filter((e) => e.section === s).map((e) => e.bank).join(', ')}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      </div>
      </div>

      <Card labelledBy="legend-h">
        <h2 id="legend-h" className="card__title">{th('map.legend')}</h2>
        <p>{t('map.legendLifts')}</p>
        <h3>{th('map.muster')}</h3>
        <ul className="plain-bullets">{Object.values(MUSTER_STATIONS).map((m) => <li key={m.letter}><strong>{t('map.station', { letter: m.letter })}</strong>: {m.name}, {t('map.deckShort', { deck: m.deck })}</li>)}</ul>
        <p className="muted">{t('map.accessibleNote')}</p>
      </Card>
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}

function PlaceLine({ p, from, stepFree }: { p: Place; from: Place | null; stepFree: boolean }) {
  const banks = elevatorsNear(p).map((e) => e.bank).join(', ')
  const walk = from && from.id !== p.id ? walkMinutes(from.id, p.id, stepFree) : null
  return <>{walk !== null && <strong>{t('l7.walk', { count: walk })} </strong>}{t('map.place', { name: p.name, deck: p.deck, section: t(`map.section.${p.section}` as StringKey), banks })}{!p.stepFree && ` ${t('map.notStepFree')}`}</>
}
