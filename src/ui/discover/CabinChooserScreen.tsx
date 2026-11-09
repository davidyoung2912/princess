import { useState } from 'react'
import { FieldLabel } from '../Field'
import { Link, useSearchParams } from 'react-router'
import { compareMatrix, MAX_COMPARE, NO_FILTER, notIncluded, type CabinFilter, type CabinScore, type CompareColumn } from '../../domain/cabinScore'
import { capacityIn, FARES, fareOptions, type FareId } from '../../domain/fares'
import { sailingFor } from '../../domain/shipCatalogue'
import { classOf } from '../../domain/cabins'
import { categoryById, type CategoryId } from '../../domain/ship'
import { useSailing } from '../../hooks/useDemo'
import { usePricedSailings, useRoomChoices } from '../../hooks/useShipCatalogue'
import { useJourneyEvent } from '../../hooks/useJourneyEvent'
import { t, th, type StringKey } from '../../i18n'
import { comfortIndicators, GUEST_REPORTS_NOTE } from '../../domain/cabinComfort'
import { cabinRegrets } from '../../domain/regret'
import { Card } from '../Card'
import { RegretCards } from './RegretCards'
import { CabinPhotos } from './CabinPhotos'
import { FeedWaiting } from '../FeedWaiting'
import { ShareCard } from '../delights/Exports'
import { CabinExtras, LeftOffCard } from '../delights/DiscoverDelights'
import { loadLastComparison, saveLastComparison } from '../../settings/lastComparison'
import { compareQuery, comparisonCard, parseCompareQuery } from '../../domain/export'
import { CABIN_ASKS, cabinFilterFrom, type AskValue } from '../../ai/stanleyAsk'
import { stanleyLevelFor } from '../../settings/settings'
import { useSettings } from '../../hooks/useSettings'
import { Button } from '../Button'
import { StanleyAsk, type AskItem } from '../ai/StanleyAsk'
import { cabinGuideFeed } from '../../feeds/cabinGuide'
import { useFeed, useFeedList } from '../../hooks/useServedFeeds'

const FILTERS = ['quiet', 'calmSea', 'accessible', 'clearView', 'availableOnly'] as const

const stars = (n: number): string => `${n} / 5`

/** The cabin chooser (S1-02 to S1-05, S1-07, S1-08): a score for sleep, motion and noise with the reasons, the sun side, a comparison of up to three, and what the fare leaves out. */
export function CabinChooserScreen() {
  const demo = useSailing()
  const [params] = useSearchParams()
  // A shared comparison link opens with the same sailing, party, fare and picks; anything that does not match the guide is ignored.
  const [shared] = useState(() => parseCompareQuery(params.toString()))
  // Every ship has its own staterooms, scores and sun side (AB2), so every priced sailing is offered, each with its own ship's room types.
  const sailings = usePricedSailings()
  const [pickedSailing, setSailingId] = useState(shared.sailingId ?? demo.id)
  const sailingId = sailings.some((s) => s.id === pickedSailing) ? pickedSailing : (sailings[0]?.id ?? pickedSailing)
  const rooms = useRoomChoices(sailingId)
  useJourneyEvent('cabinView', sailingId)
  const [wantedCategory, setCategory] = useState<CategoryId>('balcony')
  // The room type asked for, or the same class on this ship (balcony on Sky is `sky-balcony`), or the ship's first.
  const category = rooms.some((r) => r.id === wantedCategory) ? wantedCategory : (rooms.find((r) => classOf(r.id) === classOf(wantedCategory))?.id ?? rooms[0]?.id ?? wantedCategory)
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? categoryById(id)?.name ?? ''
  const [guests, setGuests] = useState(shared.guests ?? 2)
  const [fare, setFare] = useState<FareId>(shared.fare && shared.fare in FARES ? (shared.fare as FareId) : 'standard')
  const [filter, setFilter] = useState<CabinFilter>(NO_FILTER)
  // "Tell me which one": Stanley asks yes or no questions and sets the filters; the guest can still change every filter by hand.
  const [settings] = useSettings()
  const [asking, setAsking] = useState<'idle' | 'ask' | 'done'>('idle')
  const [told, setTold] = useState<Record<string, AskValue | undefined>>({})
  const askItems: AskItem[] = CABIN_ASKS.map((q) => ({
    id: q.id,
    prompt: t(`stanley.ask.cabin.${q.id}` as StringKey),
    why: t(`stanley.ask.cabin.${q.id}.why` as StringKey),
    options: [{ value: 'yes', label: t('stanley.ask.cabin.yes') }, { value: 'no', label: t('stanley.ask.cabin.no') }],
  }))
  const [picked, setPicked] = useState<{ category: CategoryId; number: string }[]>(() => (shared.picks ?? []).filter((p) => p.category.length > 0).map((p) => ({ category: p.category as CategoryId, number: p.number })))

  // D1-7: the comparison this device had open last time, offered once and only when this visit did not start from a shared link.
  const [left, setLeft] = useState<Partial<ReturnType<typeof parseCompareQuery>> | null>(() => {
    if (params.toString()) return null
    const last = parseCompareQuery(loadLastComparison())
    return last.picks?.length ? last : null
  })
  const reopen = () => {
    if (!left) return
    if (left.sailingId && sailings.some((s) => s.id === left.sailingId)) setSailingId(left.sailingId)
    if (left.guests) setGuests(left.guests)
    if (left.fare && left.fare in FARES) setFare(left.fare as FareId)
    setPicked((left.picks ?? []).filter((p) => p.category.length > 0).map((p) => ({ category: p.category as CategoryId, number: p.number })))
    setLeft(null)
  }

  const sailing = sailingFor(sailingId) ?? demo
  const options = fareOptions(category)
  const useFare: FareId = options.includes(fare) ? fare : options[0]
  const maxGuests = capacityIn(sailingId, category)
  const useGuests = Math.min(guests, maxGuests)
  const guide = useFeed(cabinGuideFeed, sailing.id, category, filter)
  const cabins = guide ?? []
  const pickedGuides = useFeedList(cabinGuideFeed, picked.map((p) => [sailing.id, p.category, { ...NO_FILTER, availableOnly: false }] as [string, CategoryId, CabinFilter]))
  const isPicked = (c: CabinScore) => picked.some((p) => p.category === c.category && p.number === c.cabin.number)
  const toggle = (c: CabinScore) => {
    const next = isPicked(c) ? picked.filter((p) => !(p.category === c.category && p.number === c.cabin.number)) : picked.length >= MAX_COMPARE ? picked : [...picked, { category: c.category, number: c.cabin.number }]
    setPicked(next)
    // D1-7: remembered on this device when the guest picks, never on a timer.
    if (next.length > 0) saveLastComparison(compareQuery({ sailingId, guests: useGuests, fare: useFare, picks: next }))
  }

  const columns: CompareColumn[] = picked.flatMap((p, i): CompareColumn[] => {
    const found = pickedGuides[i]?.find((c) => c.cabin.number === p.number)
    if (!found) return []
    const f = fareOptions(p.category).includes(useFare) ? useFare : fareOptions(p.category)[0]
    return [{ id: p.number, label: `${roomName(p.category)} ${p.number}`, category: p.category, fare: f, score: found }]
  })
  const rows = columns.length >= 2 ? compareMatrix(sailing.id, useGuests, columns) : []

  return (
    <div className="page">
      <p>{t('cabins.intro')}</p>
      <p className="muted">{t('cabins.sample')}</p>

      {left && picked.length === 0 && <LeftOffCard picks={left.picks ?? []} onOpen={reopen} onForget={() => { saveLastComparison(''); setLeft(null) }} />}

      {stanleyLevelFor(settings) !== 'off' && asking === 'idle' && (
        <div className="stanley-why no-print">
          <p>{t('stanley.ask.cabin.intro')}</p>
          <Button variant="secondary" onClick={() => setAsking('ask')}>{t('stanley.ask.cabin.start')}</Button>
        </div>
      )}
      {asking === 'ask' && (
        <StanleyAsk
          title={t('stanley.ask.cabin.title')}
          items={askItems}
          values={told}
          onChange={(id, v) => setTold((x) => ({ ...x, [id]: v }))}
          onDone={(final) => { setFilter(cabinFilterFrom(final)); setAsking('done') }}
          onShowAll={() => setAsking('idle')}
        />
      )}
      {asking === 'done' && (
        <div className="stanley-why no-print">
          <p role="status">{t('stanley.ask.cabin.done')}</p>
          <Button variant="secondary" onClick={() => setAsking('ask')}>{t('stanley.ask.change')}</Button>
        </div>
      )}

      <Card labelledBy="cabins-pick">
        <h2 id="cabins-pick" className="card__title">{th('cabins.choose')}</h2>
        <div className="field">
          <label htmlFor="cabins-sailing">{t('cost.sailing')}</label>
          <select id="cabins-sailing" value={sailing.id} onChange={(e) => { setSailingId(e.target.value); setPicked([]) }}>
            {sailings.map((s) => <option key={s.id} value={s.id}>{s.departure} · {s.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cabins-room">{t('cost.room')}</label>
          <select id="cabins-room" value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cabins-guests">{t('cost.guests')}</label>
          <select id="cabins-guests" value={useGuests} onChange={(e) => setGuests(Number(e.target.value))}>
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <FieldLabel htmlFor="cabins-fare" help={t('helptip.fareType')}>{t('cabins.fare')}</FieldLabel>
          <select id="cabins-fare" value={useFare} onChange={(e) => setFare(e.target.value as FareId)}>
            {options.map((f) => <option key={f} value={f}>{FARES[f].name}</option>)}
          </select>
        </div>
        <fieldset className="field">
          <legend>{t('cabins.filters')}</legend>
          {FILTERS.map((k) => (
            <label key={k} className="choice"><input type="checkbox" checked={filter[k]} onChange={(e) => setFilter({ ...filter, [k]: e.target.checked })} /><span>{t(`cabins.filter.${k}` as StringKey)}</span></label>
          ))}
        </fieldset>
      </Card>

      <CabinPhotos category={category} />

      <h2>{th('cabins.found', { count: cabins.length })}</h2>
      {!guide && <FeedWaiting />}
      {guide && cabins.length === 0 && <p>{t('cabins.none')}</p>}
      {cabins.map((c) => (
        <Card key={c.cabin.number}>
          <h3>{th('cabins.cabin', { number: c.cabin.number, deck: c.cabin.deck })}</h3>
          <p className="muted">{t(`cabins.pos.${c.cabin.position}` as StringKey)} · {t(`cabins.side.${c.cabin.side}` as StringKey)}</p>
          <dl className="recap-stats">
            <div><dt>{t('cabins.sleep')}</dt><dd>{stars(c.sleep)}</dd></div>
            <div><dt>{t('cabins.motion')}</dt><dd>{stars(c.motion)}</dd></div>
            <div><dt>{t('cabins.noise')}</dt><dd>{stars(c.noise)}</dd></div>
          </dl>
          <h4>{t('cabins.comfort')}</h4>
          <ul className="plain-bullets">{comfortIndicators(c).map((i) => <li key={i.key}><strong>{t(`cabins.basis.${i.basis}` as StringKey)}:</strong> {i.text}</li>)}</ul>
          <p className="muted">{GUEST_REPORTS_NOTE}</p>
          {c.warnings.length > 0 && <ul className="plain-bullets">{c.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
          <RegretCards cards={cabinRegrets(c)} heading={t('regret.cabin')} headingId={`regret-${c.cabin.number}`} />
          <details>
            <summary>{t('cabins.why')}</summary>
            {(['sleep', 'motion', 'noise'] as const).map((k) => (
              <div key={k}>
                <h4>{t(`cabins.${k}` as StringKey)}</h4>
                <ul className="plain-bullets">{c.reasons[k].map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            ))}
            {c.sun && <><h4>{t('cabins.sun')}</h4><p>{c.sun.text} {t('cabins.sunSim')}</p></>}
          </details>
          <CabinExtras cabin={c.cabin} sailing={sailing} />
          <label className="choice">
            <input type="checkbox" checked={isPicked(c)} disabled={!isPicked(c) && picked.length >= MAX_COMPARE} onChange={() => toggle(c)} />
            <span>{t('cabins.compare')}{!isPicked(c) && picked.length >= MAX_COMPARE && <small>{t('cabins.compareFull', { count: MAX_COMPARE })}</small>}</span>
          </label>
        </Card>
      ))}

      <Card labelledBy="cabins-compare">
        <h2 id="cabins-compare" className="card__title">{th('cabins.matrix')}</h2>
        {rows.length === 0 ? <p>{t('cabins.matrixEmpty')}</p> : (
          <div className="table-scroll">
            <table className="compare-table">
              <caption className="visually-hidden">{t('cabins.matrix')}</caption>
              <thead><tr><th scope="col">{t('cabins.row')}</th>{columns.map((c) => <th key={c.id} scope="col">{c.label}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => <tr key={r.key}><th scope="row">{t(`cabins.row.${r.key}` as StringKey)}</th>{r.values.map((v, i) => <td key={columns[i].id}>{v}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">{t('cabins.priceNote')}</p>
        {rows.length > 0 && <ShareCard link={`${window.location.origin}/home/cabins?${compareQuery({ sailingId, guests: useGuests, fare: useFare, picks: picked })}`} card={comparisonCard({ columns: columns.map((c) => c.label), rows: rows.map((r) => ({ label: t(`cabins.row.${r.key}` as StringKey), values: r.values })), note: t('cabins.priceNote') })} />}
      </Card>

      <Card labelledBy="cabins-not">
        <h2 id="cabins-not" className="card__title">{th('cabins.notIncluded', { fare: FARES[useFare].name })}</h2>
        <ul className="plain-bullets">{notIncluded(useFare).map((x) => <li key={x}>{x}</li>)}</ul>
        <p><Link to="/home/cruise/cost">{t('route.tripCost')}</Link></p>
      </Card>
    </div>
  )
}
