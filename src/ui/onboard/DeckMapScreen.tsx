import { useState } from 'react'
import { DECKS, ELEVATORS, elevatorsNear, MUSTER_STATIONS, placesOnDeck, searchPlaces, type Place, type Section } from '../../domain/deck'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { BackLink } from './common'

const SECTIONS: readonly Section[] = ['forward', 'midship', 'aft']

/**
 * The deck plan (OB-04): search, then each deck as a table of forward, midship and aft, with elevators, muster stations and step-free marks.
 * Text first, so it works with a screen reader, at the largest text size and offline; there is no location, so no "you are here".
 */
export function DeckMapScreen() {
  const [query, setQuery] = useState('')
  const [deck, setDeck] = useState(7)
  const [stepFree, setStepFree] = useState(false)
  const found = searchPlaces(query).filter((p) => !stepFree || p.stepFree)
  const here = placesOnDeck(deck).filter((p) => !stepFree || p.stepFree)
  return (
    <div className="page">
      <h1>{t('route.deckMap')}</h1>
      <Banner kind="info" title={t('map.noLocation')}><p>{t('map.noLocationBody')}</p></Banner>

      <div className="field">
        <label htmlFor="map-search">{t('map.search')}</label>
        <p className="field__hint">{t('map.searchHint')}</p>
        <input id="map-search" type="search" className="field__input" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="chip-row"><Chip pressed={stepFree} onToggle={() => setStepFree(!stepFree)}>{t('map.stepFree')}</Chip></div>

      {query.trim() !== '' && (
        <section aria-labelledby="found-h">
          <h2 id="found-h">{t('map.results')}</h2>
          <p role="status">{t('map.found', { count: found.length })}</p>
          <ul className="plain-bullets">{found.map((p) => <li key={p.id}><PlaceLine p={p} /></li>)}</ul>
        </section>
      )}

      <section aria-labelledby="deck-h">
        <h2 id="deck-h">{t('map.deck', { deck })}</h2>
        <div className="chip-row" role="group" aria-label={t('map.pickDeck')}>
          {DECKS.map((d) => <Chip key={d} pressed={d === deck} onToggle={() => setDeck(d)}>{t('map.deckShort', { deck: d })}</Chip>)}
        </div>
        <div className="table-wrap">
          <table className="deck-table">
            <caption>{t('map.deck', { deck })}</caption>
            <thead><tr>{SECTIONS.map((s) => <th key={s} scope="col">{t(`map.section.${s}` as StringKey)}</th>)}</tr></thead>
            <tbody>
              <tr>
                {SECTIONS.map((s) => (
                  <td key={s}>
                    {here.filter((p) => p.section === s).length === 0 ? <span className="muted">{t('map.empty')}</span> : (
                      <ul className="plain-bullets">{here.filter((p) => p.section === s).map((p) => <li key={p.id}>{p.name}{!p.stepFree && ` (${t('onb.notStepFree')})`}{p.note ? <small className="muted"><br />{p.note}</small> : null}</li>)}</ul>
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
        <h2 id="legend-h" className="card__title">{t('map.legend')}</h2>
        <p>{t('map.legendLifts')}</p>
        <h3>{t('map.muster')}</h3>
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
