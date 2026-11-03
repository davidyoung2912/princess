import { useEffect, useState } from 'react'
import { formatDate } from '../../domain/cruise'
import { DIRECTORY } from '../../domain/menus'
import { PORTS, type Sailing } from '../../domain/sailings'
import { dateIn } from '../../domain/timezones'
import {
  addPostcard, addWant, callPlaces, lifetime, mapView, markPostcardRead, POSTCARD_MAX, postcardsDue, rankedFavourites, removePostcard, removeWant, sailedSummary, sailedTrips, wantMatches, WANT_LEN, WANTS_MAX,
} from '../../domain/rememberDelights'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { t, th, type StringKey } from '../../i18n'
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
      <h2 id="dl9-card-h" className="card__title no-print">{th('dl9.card.title')}</h2>
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
      <h2 id="dl9-arrive-h" className="card__title">{th('dl9.arrive.title')}</h2>
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

/** The land outlines are a large path, so they load only when a map is shown. */
function useLand(): string | null {
  const [land, setLand] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void import('../../domain/landPath').then((m) => { if (live) setLand(m.LAND_PATH) })
    return () => { live = false }
  }, [])
  return land
}

/** D8-2: a map of every port on the guest's record, from the trip history the server keeps, so it holds every past cruise and every device. The list carries the facts; the map is a picture of them. */
export function SailedMap() {
  const history = useMine(() => api.post.history(), [])
  const land = useLand()
  const s = sailedSummary(sailedTrips(history.data?.trips ?? []))
  const view = mapView(s.ports)
  const unit = view.span / 100
  return (
    <Card labelledBy="dl9-map-h">
      <h2 id="dl9-map-h" className="card__title">{th('dl9.map.title')}</h2>
      {history.status === 'loading' && <p role="status">{t('dl9.map.loading')}</p>}
      {history.status === 'error' && <p role="status">{t('dl9.map.failed')}</p>}
      {history.status === 'ready' && s.trips === 0 && <p>{t('dl9.map.none')}</p>}
      {s.trips > 0 && (
        <>
          <svg className="dl9-map" viewBox={view.viewBox} aria-hidden="true" focusable="false">
            {land && <path className="dl9-map__land" d={land} fillRule="evenodd" vectorEffect="non-scaling-stroke" />}
            {view.pins.map((p) => <circle key={p.code} cx={p.x} cy={p.y} r={unit * (0.9 + Math.min(p.visits, 4) * 0.25)} className="dl9-map__pin" />)}
            {view.pins.map((p) => <text key={`${p.code}-t`} x={p.x + unit * 1.8} y={p.y + unit * 0.5} fontSize={unit * 2.4}>{p.name.split(',')[0]}</text>)}
          </svg>
          <p>{t('dl9.map.summary', { trips: s.trips, nights: s.nights, ports: s.ports.length })}</p>
          <ul className="plain-list">{s.ports.map((p) => <li key={p.place.code}><span>{p.place.name}</span><span>{t('dl9.map.visits', { count: p.visits })}</span></li>)}</ul>
        </>
      )}
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
      <h2 id="dl9-fav-h" className="card__title">{th('dl9.fav.title')}</h2>
      {ranked.length === 0 ? <p>{t('dl9.fav.none')}</p> : (
        <ol className="plain-list">
          {ranked.map((r) => <li key={`${r.kind}-${r.id}`}><span>{r.label}</span><span className="muted">{t(`dl9.fav.${r.kind}` as StringKey, { count: r.score })}</span></li>)}
        </ol>
      )}
      <p className="muted">{t('dl9.fav.note')}</p>
    </Card>
  )
}

/** D8-5: lifetime nights and different ports in plain words, for the loyalty view, from the same trip record as the map. */
export function LifetimeLine() {
  const history = useMine(() => api.post.history(), [])
  if (history.status !== 'ready') return null
  const l = lifetime(sailedTrips(history.data.trips))
  if (l.nights === 0) return null
  return <p>{t('dl9.life', { nights: l.nights, ports: l.ports })}</p>
}

/** D8-7 (matching): which of the guest's wanted places a sailing calls at. Quiet when the list is empty. */
export function WantMatchLine({ sailing }: { sailing: Sailing }) {
  const { state } = useMemory()
  if (state.remember.wants.length === 0) return null
  const hits = wantMatches(state.remember.wants, callPlaces(sailing))
  return hits.length > 0
    ? <p className="tag tag--good">{t('dl9.want.on', { places: [...new Set(hits.map((h) => h.place))].join('; ') })}</p>
    : <p className="muted">{t('dl9.want.off')}</p>
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
      <h2 id="dl9-want-h" className="card__title">{th('dl9.want.title')}</h2>
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
