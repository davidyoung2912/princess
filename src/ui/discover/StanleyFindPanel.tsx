import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import {
  COMPARE_MAX, TEXT_MAX, WEIGHT_MAX, chipsLeft, defaultWeights, normalizeBrief, normalizeComparison, normalizeDirections, normalizeInterview, toggleShortlist, withoutChip,
  type Brief, type Comparison, type Criterion, type DiscoverChip, type DiscoverFilters, type Directions, type Weights,
} from '../../ai/stanleyDiscover'
import { t, th } from '../../i18n'
import { useStanleyMemory } from '../../hooks/useStanleyMemory'
import { stanleyDiscover } from '../../runtime'
import { formatMoney } from '../../domain/money'
import { Button } from '../Button'
import { Card } from '../Card'
import { ComparisonResult, WeightFields } from './WeightedCompare'

type Busy = '' | 'read' | 'find' | 'compare' | 'save' | 'share'

/**
 * Tell Stanley what you want (phase 8). The guest writes a wish; the server turns it into chips the guest can remove, lists what it assumed, finds two or more distinct directions with trade-offs, and compares
 * the short list with weights the guest sets. The brief is saved on the server so any device picks it up. Every figure shown was calculated by the server from the catalogue.
 */
export function StanleyFindPanel() {
  const textId = useId()
  const [text, setText] = useState('')
  const [filters, setFilters] = useState<DiscoverFilters>({})
  const [chips, setChips] = useState<DiscoverChip[]>([])
  const [assumptions, setAssumptions] = useState<string[]>([])
  const [understood, setUnderstood] = useState<boolean | null>(null)
  const [directions, setDirections] = useState<Directions | null>(null)
  const [shortlist, setShortlist] = useState<string[]>([])
  const [weights, setWeights] = useState<Weights>(defaultWeights())
  const [needs, setNeeds] = useState<string[]>([])
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [busy, setBusy] = useState<Busy>('')
  const [notice, setNotice] = useState('')
  const [failed, setFailed] = useState(false)
  const [shared, setShared] = useState('')
  const [includeNeeds, setIncludeNeeds] = useState(false)
  const [keepNeeds, setKeepNeeds] = useState(false)
  // Access and diet are kept in the brief only when the guest ticks the box, and only when Stanley's memory is on and the guest let answers use them.
  const memory = useStanleyMemory()
  const offeredNeeds = memory.state.enabled ? memory.state.items.filter((i) => i.sensitive && i.shared).map((i) => i.text.slice(0, 60)).slice(0, 6) : []

  // Pick up the saved brief, so a guest who began on another device carries on.
  useEffect(() => {
    let live = true
    stanleyDiscover.getBrief().then((raw) => {
      if (!live) return
      const { brief, updatedAt } = normalizeBrief(raw)
      if (updatedAt === null) return
      setText(brief.text); setFilters(brief.filters); setShortlist(brief.shortlist); setWeights(brief.weights); setNeeds(brief.needs); setKeepNeeds(brief.needs.length > 0)
      setNotice(t('find8.resumed'))
    }, () => undefined)
    return () => { live = false }
  }, [])

  const run = async (kind: Busy, work: () => Promise<void>) => {
    setBusy(kind); setFailed(false); setNotice('')
    try { await work() } catch { setFailed(true) } finally { setBusy('') }
  }

  const read = () => run('read', async () => {
    const r = normalizeInterview(await stanleyDiscover.interview(text.trim()))
    setFilters(r.filters); setChips(r.chips); setAssumptions(r.assumptions); setUnderstood(r.understood); setDirections(null); setComparison(null)
  })
  const find = (f: DiscoverFilters) => run('find', async () => { setDirections(normalizeDirections(await stanleyDiscover.directions(f))) })
  const remove = (key: string) => { const next = withoutChip(filters, key); setFilters(next); setChips(chipsLeft(chips, [key])); void find(next) }
  const compare = () => run('compare', async () => { setComparison(normalizeComparison(await stanleyDiscover.compare(shortlist, weights, filters))) })
  const save = () => run('save', async () => {
    const kept = keepNeeds ? offeredNeeds : []
    const brief: Brief = { text: text.trim(), filters, shortlist, weights, needs: kept, title: '' }
    await stanleyDiscover.saveBrief(brief)
    setNeeds(kept)
    setNotice(t('find8.saved'))
  })
  const share = () => run('share', async () => { setShared((await stanleyDiscover.share(includeNeeds)).text) })
  const setWeight = (c: Criterion, v: number) => { setWeights({ ...weights, [c]: Math.min(WEIGHT_MAX, Math.max(0, v)) }); setComparison(null) }
  const nameOf = (id: string) => directions?.directions.find((d) => d.sailingId === id)?.title ?? comparison?.rows.find((r) => r.sailingId === id)?.title ?? id

  return (
    <Card labelledBy="find8-h">
      <h2 id="find8-h" className="card__title">{th('find8.title')}</h2>
      <p>{t('find8.intro')}</p>
      <div className="field">
        <label htmlFor={textId}>{t('find8.label')}</label>
        <textarea id={textId} rows={3} maxLength={TEXT_MAX} value={text} placeholder={t('find8.example')} onChange={(e) => setText(e.target.value)} />
      </div>
      <Button onClick={() => void read()} disabled={busy !== '' || text.trim() === ''}>{t('find8.read')}</Button>
      {failed && <p role="alert">{t('find8.failed')}</p>}
      {notice && <p role="status">{notice}</p>}

      {understood === false && <p role="status">{t('find8.notUnderstood')}</p>}
      {chips.length > 0 && (
        <section aria-labelledby="find8-chips-h">
          <h3 id="find8-chips-h">{t('find8.chips')}</h3>
          <ul className="plain-list">
            {chips.map((c) => (
              <li key={c.key}>
                <span>{c.label}</span>{c.assumed && <span className="tag"> {t('find8.assumed')}</span>}{' '}
                <Button variant="tertiary" onClick={() => remove(c.key)}>{t('find8.remove', { what: c.label })}</Button>
              </li>
            ))}
          </ul>
          {assumptions.length > 0 && (
            <>
              <h3>{t('find8.assumptions')}</h3>
              <ul>{assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
            </>
          )}
          <Button onClick={() => void find(filters)} disabled={busy !== ''}>{t('find8.find')}</Button>
        </section>
      )}

      {directions && (
        <section aria-labelledby="find8-dir-h">
          <h3 id="find8-dir-h">{t('find8.directions')}</h3>
          {directions.note === 'none' && <p role="status">{t('find8.none')}</p>}
          {directions.note === 'onlyOne' && <p role="status">{t('find8.onlyOne')}</p>}
          <ul className="card-grid">
            {directions.directions.map((d) => (
              <li key={d.sailingId} className="card">
                <h4><Link to={`/home/sailings/${d.sailingId}`}>{d.title}</Link></h4>
                <p><strong>{d.label}</strong>, {d.departure}, {t('find8.nights', { count: d.nights })}{d.perNightCents !== null && `, ${t('find8.from', { price: formatMoney(d.perNightCents) })}`}</p>
                <ul>{d.tradeOffs.map((x) => <li key={x}>{x}</li>)}</ul>
                {d.met.length > 0 && <p className="muted">{t('find8.met', { list: d.met.join('; ') })}</p>}
                {d.missed.length > 0 && <p className="muted">{t('find8.missed', { list: d.missed.join('; ') })}</p>}
                {d.noData.length > 0 && <p className="muted">{t('find8.noData', { list: d.noData.join('; ') })}</p>}
                <label className="choice">
                  <input type="checkbox" checked={shortlist.includes(d.sailingId)} onChange={() => { setShortlist(toggleShortlist(shortlist, d.sailingId)); setComparison(null) }} />
                  <span>{t('find8.shortlist')}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {shortlist.length > 0 && (
        <section aria-labelledby="find8-cmp-h">
          <h3 id="find8-cmp-h">{t('find8.compare', { count: shortlist.length })}</h3>
          <ul>{shortlist.map((id) => <li key={id}>{nameOf(id)}</li>)}</ul>
          {shortlist.length >= 2 && shortlist.length <= COMPARE_MAX && (
            <>
              <WeightFields weights={weights} onChange={setWeight} />
              <Button onClick={() => void compare()} disabled={busy !== ''}>{t('find8.compareNow')}</Button>
            </>
          )}
          {shortlist.length < 2 && <p className="muted">{t('find8.pickTwo')}</p>}
        </section>
      )}

      {comparison && <ComparisonResult comparison={comparison} nameOf={nameOf} />}

      <section aria-labelledby="find8-brief-h">
        <h3 id="find8-brief-h">{t('find8.brief')}</h3>
        <p>{t('find8.briefBody')}</p>
        <Button onClick={() => void save()} disabled={busy !== '' || (text.trim() === '' && shortlist.length === 0)}>{t('find8.save')}</Button>{' '}
        <Button variant="secondary" onClick={() => void share()} disabled={busy !== ''}>{t('find8.share')}</Button>
        {offeredNeeds.length > 0 && (
          <label className="choice">
            <input type="checkbox" checked={keepNeeds} onChange={(e) => setKeepNeeds(e.target.checked)} />
            <span>{t('find8.keepNeeds')}</span>
          </label>
        )}
        {needs.length > 0 && (
          <label className="choice">
            <input type="checkbox" checked={includeNeeds} onChange={(e) => setIncludeNeeds(e.target.checked)} />
            <span>{t('find8.includeNeeds')}</span>
          </label>
        )}
        {shared && <pre className="share-text" aria-label={t('find8.sharedLabel')}>{shared}</pre>}
      </section>
    </Card>
  )
}
