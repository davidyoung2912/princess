import { useState } from 'react'
import { useCatalogue } from '../../hooks/useCatalogue'
import { t, th, type StringKey } from '../../i18n'
import { cutaway, shipLiteracy, type LiteracyStop } from '../../domain/shipLiteracy'
import { Card } from '../Card'
import { PrintCard } from '../delights/Cards'

function whereText(s: LiteracyStop): string {
  if (!s.reachable) return t('lit.noWay')
  const up = s.decksUp === 0 ? t('lit.same') : s.decksUp > 0 ? t('lit.up', { count: s.decksUp }) : t('lit.down', { count: -s.decksUp })
  const along = s.sectionsAft === 0 ? t('lit.sameEnd') : s.sectionsAft > 0 ? t('lit.aftBy', { count: s.sectionsAft }) : t('lit.fwd', { count: -s.sectionsAft })
  return `${up}, ${along}${s.banks.length > 0 ? `, ${t('lit.banks', { banks: s.banks.join(', ') })}` : ''}`
}

/**
 * Visual ship literacy (QOL-17): four rules of deck logic, then, for a cabin number the guest types (not saved), a side-on list of decks and
 * the way to the first places guests look for. Text first: every row says in words what it shows, and the screen says it is not navigation.
 */
export function ShipLiteracy() {
  useCatalogue()
  const [cabin, setCabin] = useState('')
  const lit = cabin.trim() === '' ? null : shipLiteracy(cabin)
  return (
    <Card labelledBy="lit-h">
      <h2 id="lit-h" className="card__title">{th('lit.title')}</h2>
      <p>{t('lit.intro')}</p>
      <ul className="plain-bullets">{(['lit.rule1', 'lit.rule2', 'lit.rule3', 'lit.rule4'] as const).map((k) => <li key={k}>{t(k)}</li>)}</ul>
      <div className="field">
        <label htmlFor="lit-cabin">{t('lit.cabin')}</label>
        <p className="field__hint" id="lit-cabin-h">{t('lit.cabinHint')}</p>
        <input id="lit-cabin" className="field__input" inputMode="numeric" autoComplete="off" aria-describedby="lit-cabin-h" value={cabin} onChange={(e) => setCabin(e.target.value)} />
      </div>
      {cabin.trim() !== '' && !lit && <p role="alert">{t('lit.bad')}</p>}
      {lit && (
        <div role="status">
          <p>{t('lit.you', { cabin: lit.cabin.id.slice(6), deck: lit.cabin.deck, section: t(`map.section.${lit.cabin.section}` as StringKey), banks: lit.nearBanks.join(', ') })}</p>
          <h3>{th('lit.stops')}</h3>
          <ul className="plain-bullets">{lit.stops.map((s) => <li key={s.place.id}><strong>{s.place.name}</strong>: {whereText(s)}</li>)}</ul>
          <PrintCard label={t('lit.print')} card={{ id: 'ship-map', title: t('lit.print'), subtitle: t('lit.you', { cabin: lit.cabin.id.slice(6), deck: lit.cabin.deck, section: t(`map.section.${lit.cabin.section}` as StringKey), banks: lit.nearBanks.join(', ') }), lines: lit.stops.map((s) => `${s.place.name}: ${whereText(s)}`), footer: t('lit.notNav'), large: true }} />
          <h3>{th('lit.cutTitle')}</h3>
          <ol className="ship-lit__cut" aria-label={t('lit.cutDesc')}>
            {cutaway(lit).map((d) => (
              <li key={d.deck} className={`ship-lit__deck${d.cabin ? ' ship-lit__deck--cabin' : ''}`}>
                <span className="ship-lit__deck-n">{t('map.deckShort', { deck: d.deck })}</span>
                <span>
                  {d.cabin ? `${t('lit.cutCabin')}${d.destinations.length > 0 ? ', ' : ''}` : ''}
                  {d.destinations.length > 0 ? d.destinations.join(', ') : d.cabin ? '' : d.count === 0 ? t('lit.cutNone') : t('lit.cutRooms', { count: d.count })}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="muted">{t('lit.notNav')} {t('lit.routeLink')}</p>
    </Card>
  )
}
