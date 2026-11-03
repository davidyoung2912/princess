import { useState } from 'react'
import { formatDate } from '../../domain/cruise'
import { DIRECTORY } from '../../domain/menus'
import { PORTS, shipZoneAt } from '../../domain/sailings'
import { dateIn } from '../../domain/timezones'
import {
  addPostcard, addWant, keepVoyage, lifetime, MAP_SPOTS, markPostcardRead, POSTCARD_MAX, postcardsDue, rankedFavourites, removePostcard, removeWant, sailedSummary, voyageDone, voyageOf, WANT_LEN, WANTS_MAX,
} from '../../domain/rememberDelights'
import { useNow, useSailing } from '../../hooks/useDemo'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field, TextArea } from '../Field'

/** D8-1 (writing): a note to the person who will be counting down to the next trip. It stays on the guest's devices until it arrives. */
export function PostcardWriter() {
  const sailing = useSailing()
  const now = useNow()
  const { state, update } = useMemory()
  const [text, setText] = useState('')
  const list = state.remember.postcards
  const add = () => {
    const next = addPostcard(list, { id: newMemoryId(), text, at: now, sailingId: sailing.id, read: false })
    if (next.length === list.length) return
    update((s) => ({ ...s, remember: { ...s.remember, postcards: next } }))
    setText('')
  }
  return (
    <Card labelledBy="dl9-card-h">
      <h2 id="dl9-card-h" className="card__title no-print">{t('dl9.card.title')}</h2>
      <div className="no-print">
        <p>{t('dl9.card.body')}</p>
        <TextArea label={t('dl9.card.label')} value={text} maxLength={POSTCARD_MAX} onChange={(e) => setText(e.target.value)} />
        <Button onClick={add} disabled={text.trim() === ''}>{t('dl9.card.add')}</Button>
        {list.length > 0 && (
          <ul className="plain-list">
            {list.map((p) => (
              <li key={p.id}>
                <span>{p.text}</span>
                <Button variant="tertiary" onClick={() => update((s) => ({ ...s, remember: { ...s.remember, postcards: removePostcard(s.remember.postcards, p.id) } }))}>{t('dl9.card.remove')}<span className="visually-hidden"> {p.text.slice(0, 30)}</span></Button>
              </li>
            ))}
          </ul>
        )}
        <p className="muted">{t('dl9.card.note')}</p>
      </div>
    </Card>
  )
}

/** D8-1 (arriving): on Home, within sixty days of a later trip. Read it once, then it is put away. */
export function PostcardArrives({ sailingId, daysToDeparture }: { sailingId: string; daysToDeparture: number }) {
  const { state, update } = useMemory()
  const due = postcardsDue(state.remember.postcards, sailingId, daysToDeparture)
  if (due.length === 0) return null
  return (
    <Card labelledBy="dl9-arrive-h">
      <h2 id="dl9-arrive-h" className="card__title">{t('dl9.arrive.title')}</h2>
      {due.map((p) => (
        <figure key={p.id} className="dl9-postcard">
          <blockquote>{p.text}</blockquote>
          <figcaption className="muted">{t('dl9.arrive.from', { date: formatDate(dateIn(p.at, 'UTC')) })}</figcaption>
          <Button variant="secondary" onClick={() => update((s) => ({ ...s, remember: { ...s.remember, postcards: markPostcardRead(s.remember.postcards, p.id) } }))}>{t('dl9.arrive.done')}</Button>
        </figure>
      ))}
    </Card>
  )
}

/** D8-2: a sketch map and a list of every port across the trips the guest has kept. The list carries the facts; the sketch is a picture of them. */
export function SailedMap() {
  const sailing = useSailing()
  const now = useNow()
  const { state, update } = useMemory()
  const voyages = state.remember.voyages
  const finished = voyageDone(sailing, dateIn(now, shipZoneAt(sailing, now)))
  const canKeep = finished && !voyages.some((v) => v.sailingId === sailing.id)
  const s = sailedSummary(voyages)
  return (
    <Card labelledBy="dl9-map-h">
      <h2 id="dl9-map-h" className="card__title">{t('dl9.map.title')}</h2>
      {s.trips === 0 ? <p>{t('dl9.map.none')}</p> : (
        <>
          <svg className="dl9-map" viewBox="0 0 100 60" aria-hidden="true" focusable="false">
            {s.ports.map((p) => <g key={p.port}><circle cx={MAP_SPOTS[p.port].x} cy={MAP_SPOTS[p.port].y} r={2 + Math.min(p.visits, 4)} /><text x={MAP_SPOTS[p.port].x + 4} y={MAP_SPOTS[p.port].y + 1.5}>{PORTS[p.port].name}</text></g>)}
          </svg>
          <p>{t('dl9.map.summary', { trips: s.trips, nights: s.nights, ports: s.ports.length })}</p>
          <ul className="plain-list">{s.ports.map((p) => <li key={p.port}><span>{PORTS[p.port].name}</span><span>{t('dl9.map.visits', { count: p.visits })}</span></li>)}</ul>
        </>
      )}
      {canKeep && <Button onClick={() => update((m) => ({ ...m, remember: { ...m.remember, voyages: keepVoyage(m.remember.voyages, voyageOf(sailing)) } }))}>{t('dl9.map.keep')}</Button>}
      <p className="muted">{t('dl9.map.note')}</p>
    </Card>
  )
}

/** D8-3: the guest's own hearts, likes and pins, counted and put in order. Nothing is rated for them. */
export function FavouritesRanked() {
  const { state } = useMemory()
  const ranked = rankedFavourites({
    favourites: state.sea.favourites, diary: state.sea.diary, pins: state.ports.pins,
    venueName: (id) => DIRECTORY.find((v) => v.id === id)?.name ?? id, portName: (p) => PORTS[p].name,
  })
  return (
    <Card labelledBy="dl9-fav-h">
      <h2 id="dl9-fav-h" className="card__title">{t('dl9.fav.title')}</h2>
      {ranked.length === 0 ? <p>{t('dl9.fav.none')}</p> : (
        <ol className="plain-list">
          {ranked.map((r) => <li key={`${r.kind}-${r.id}`}><span>{r.label}</span><span className="muted">{t(`dl9.fav.${r.kind}` as StringKey, { count: r.score })}</span></li>)}
        </ol>
      )}
      <p className="muted">{t('dl9.fav.note')}</p>
    </Card>
  )
}

/** D8-5: lifetime cruise days and ports in plain words, for the loyalty view. */
export function LifetimeLine({ days }: { days: number }) {
  const { state } = useMemory()
  const l = lifetime(days, state.remember.voyages)
  return <p>{l.ports > 0 ? t('dl9.life.both', { days: l.days, ports: l.ports }) : t('dl9.life.days', { days: l.days })}</p>
}

/** D8-7: places the guest says they want to see. Shown in Stage 0 so the next dream starts from it. */
export function WantNext() {
  const { state, update } = useMemory()
  const [text, setText] = useState('')
  const list = state.remember.wants
  const add = () => {
    const next = addWant(list, text)
    if (next.length === list.length) return
    update((s) => ({ ...s, remember: { ...s.remember, wants: next } }))
    setText('')
  }
  return (
    <Card labelledBy="dl9-want-h">
      <h2 id="dl9-want-h" className="card__title">{t('dl9.want.title')}</h2>
      <p>{t('dl9.want.body')}</p>
      <Field label={t('dl9.want.label')} value={text} maxLength={WANT_LEN} disabled={list.length >= WANTS_MAX} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
      <Button variant="secondary" onClick={add} disabled={text.trim() === '' || list.length >= WANTS_MAX}>{t('dl9.want.add')}</Button>
      {list.length >= WANTS_MAX && <p className="muted">{t('dl9.want.full')}</p>}
      {list.length > 0 && (
        <ul className="plain-list">
          {list.map((w) => (
            <li key={w}><span>{w}</span><Button variant="tertiary" onClick={() => update((s) => ({ ...s, remember: { ...s.remember, wants: removeWant(s.remember.wants, w) } }))}>{t('dl9.want.remove')}<span className="visually-hidden"> {w}</span></Button></li>
          ))}
        </ul>
      )}
    </Card>
  )
}
