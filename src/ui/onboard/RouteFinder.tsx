import { useCatalogue } from '../../hooks/useCatalogue'
import { useState } from 'react'
import { Link } from 'react-router'
import { DECKS, ELEVATORS, placesOnDeck } from '../../domain/deck'
import { cabinPlace, locate } from '../../domain/deckGraph'
import { decksOf, lineOnDeck } from '../../domain/deckPlan'
import { routeBetween, type RouteStep } from '../../domain/route'
import { useMine } from '../../hooks/useMine'
import { t, th, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Card } from '../Card'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { DeckPlan } from './DeckPlan'

function Options({ cabin }: { cabin: string | null }) {
  return (
    <>
      <option value="">{t('rt.choose')}</option>
      {cabin && <option value={`cabin:${cabin}`}>{t('rt.myCabin', { cabin })}</option>}
      {DECKS.slice().reverse().map((deck) => (
        <optgroup key={deck} label={t('map.deck', { deck })}>
          {placesOnDeck(deck).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </optgroup>
      ))}
    </>
  )
}

function stepText(s: RouteStep): string {
  if (s.kind === 'walk') return s.toward === 'near' ? t('rt.walkNear', { deck: s.deck }) : s.toward === 'forward' ? t('rt.walk.forward', { deck: s.deck }) : t('rt.walk.aft', { deck: s.deck })
  if (s.kind === 'lift') return t('rt.lift', { bank: s.bank, from: s.from, to: s.to, section: t(`map.section.${s.section}` as StringKey) })
  return t('rt.arrive', { place: locate(s.place)?.name ?? '' })
}

/** Directions between two places on the ship (ACS-02), in words, with a step-free option. The nearest alternative is offered where a place has steps. */
export function RouteFinder() {
  useCatalogue()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [stepFree, setStepFree] = useState(false)
  // Lift banks the guest has seen out of service; the app has no closure feed, so this is the guest's report.
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const toggleBank = (bank: string) => setClosed((c) => { const n = new Set(c); if (!n.delete(bank)) n.add(bank); return n })
  // The guest's own stateroom, from their booking; absent when they are not aboard or have none yet.
  const menu = useMine(() => api.orders.menu(), [])
  const cabin = menu.data && cabinPlace(menu.data.cabin) ? menu.data.cabin : null
  const result = from && to ? routeBetween(from, to, { stepFree, closed }) : null
  const route = result && result.ok ? { a: locate(from)!, b: locate(to)! } : null
  return (
    <Card labelledBy="route-h">
      <h2 id="route-h" className="card__title">{th('rt.title')}</h2>
      <p>{t('rt.intro')}</p>
      <div className="field">
        <label htmlFor="rt-from">{t('rt.from')}</label>
        <select id="rt-from" className="field__input" value={from} onChange={(e) => setFrom(e.target.value)}><Options cabin={cabin} /></select>
      </div>
      <div className="field">
        <label htmlFor="rt-to">{t('rt.to')}</label>
        <select id="rt-to" className="field__input" value={to} onChange={(e) => setTo(e.target.value)}><Options cabin={cabin} /></select>
      </div>
      {cabin && <p><Button variant="secondary" onClick={() => setTo(`cabin:${cabin}`)}>{t('rt.toCabin')}</Button></p>}
      <div className="chip-row"><Chip pressed={stepFree} onToggle={() => setStepFree(!stepFree)}>{t('rt.stepFree')}</Chip></div>
      <fieldset className="field">
        <legend>{t('rt.closedLegend')}</legend>
        <div className="chip-row">{ELEVATORS.map((e) => <Chip key={e.bank} pressed={closed.has(e.bank)} onToggle={() => toggleBank(e.bank)}>{t('rt.closedBank', { bank: e.bank })}</Chip>)}</div>
        <small className="muted">{t('rt.closedNote')}</small>
      </fieldset>
      <div role="status" aria-live="polite">
        {result === null ? <p className="muted">{t('rt.pick')}</p> : result.ok ? (
          <>
            <h3>{th('rt.how', { minutes: result.minutes })}</h3>
            <ol>{result.steps.map((s, i) => <li key={i}>{stepText(s)}</li>)}</ol>
            {result.rerouted && <p>{t('rt.rerouted')}</p>}
            {!result.stepFree && <p className="muted">{t('rt.hasSteps')}</p>}
            {route && decksOf(result.way, route.a, route.b).map((d) => <DeckPlan key={d} deck={d} line={lineOnDeck(result.way, route.a, route.b, d)} />)}
            <p className="muted">{t('rt.ports')} <Link to="/ship/port">{t('route.portDay')}</Link></p>
          </>
        ) : result.reason === 'same' ? <p>{t('rt.same')}</p> : result.reason === 'noWay' ? <p>{t('rt.noWay')}</p> : result.reason === 'unknown' ? <p>{t('rt.pick')}</p> : (
          <p>{t('rt.notStepFree', { place: result.place?.name ?? '' })}{result.instead ? ` ${t('rt.instead', { place: result.instead.name, deck: result.instead.deck })}` : ''}</p>
        )}
      </div>
    </Card>
  )
}
