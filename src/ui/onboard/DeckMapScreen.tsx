import { useCatalogue } from '../../hooks/useCatalogue'
import { useState } from 'react'
import { DECKS, ELEVATORS, elevatorsNear, MUSTER_STATIONS, placeById, placesOnDeck, searchPlaces, type Place, type Section } from '../../domain/deck'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { BackLink } from './common'
import { DeckPlan } from './DeckPlan'
import { RouteFinder } from './RouteFinder'
import { ParkMySpot } from '../delights/SeaDelights'
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
  const [hereId, setHereId] = useState('')
  const here = placeById(hereId) ?? null
  const parked = useMemory().state.sea.spot
  const pin = (parked && placeById(parked.placeId)) || null
  const found = searchPlaces(query).filter((p) => !stepFree || p.stepFree)
  const onDeck = placesOnDeck(deck).filter((p) => !stepFree || p.stepFree)
  return (
    <div className="page">
      <Banner kind="info" title={t('map.noLocation')}><p>{t('map.noLocationBody')}</p></Banner>

      <RouteFinder />
      <ParkMySpot />

      <div className="field">
        <label htmlFor="map-search">{t('map.search')}</label>
        <p className="field__hint">{t('map.searchHint')}</p>
        <input id="map-search" type="search" className="field__input" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="chip-row">
        <Chip pressed={stepFree} onToggle={() => setStepFree(!stepFree)}>{t('map.stepFree')}</Chip>
        <Chip pressed={quiet} onToggle={() => setQuiet(!quiet)}>{t('plan2.quietLayer')}</Chip>
      </div>
      <div className="field">
        <label htmlFor="map-here">{t('plan2.hereLabel')}</label>
        <p className="field__hint">{t('plan2.hereHint')}</p>
        <select id="map-here" className="field__input" value={hereId} onChange={(e) => { setHereId(e.target.value); const p = placeById(e.target.value); if (p) setDeck(p.deck) }}>
          <option value="">{t('plan2.hereNone')}</option>
          {DECKS.slice().reverse().map((d) => <optgroup key={d} label={t('map.deck', { deck: d })}>{placesOnDeck(d).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>)}
        </select>
      </div>

      {query.trim() !== '' && (
        <section aria-labelledby="found-h">
          <h2 id="found-h">{th('map.results')}</h2>
          <p role="status">{t('map.found', { count: found.length })}</p>
          <ul className="plain-bullets">{found.map((p) => <li key={p.id}><PlaceLine p={p} /></li>)}</ul>
        </section>
      )}

      <section aria-labelledby="deck-h">
        <h2 id="deck-h">{th('map.deck', { deck })}</h2>
        <div className="chip-row" role="group" aria-label={t('map.pickDeck')}>
          {DECKS.map((d) => <Chip key={d} pressed={d === deck} onToggle={() => setDeck(d)}>{t('map.deckShort', { deck: d })}</Chip>)}
        </div>
        <DeckPlan deck={deck} stepFree={stepFree} quiet={quiet} here={here} pin={pin} />
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

function PlaceLine({ p }: { p: Place }) {
  const banks = elevatorsNear(p).map((e) => e.bank).join(', ')
  return <>{t('map.place', { name: p.name, deck: p.deck, section: t(`map.section.${p.section}` as StringKey), banks })}{!p.stepFree && ` ${t('map.notStepFree')}`}</>
}
