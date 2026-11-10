import { useState } from 'react'
import { Link } from 'react-router'
import { CRITERIA, WEIGHT_MAX, defaultWeights, normalizeComparison, type Comparison, type Criterion, type Weights } from '../../ai/stanleyDiscover'
import { t, type StringKey } from '../../i18n'
import { stanleyDiscover } from '../../runtime'
import { Button } from '../Button'

/** The five weights a guest sets, 0 to 5 each (Stanley Discover, phase 8). */
export function WeightFields({ weights, onChange }: { weights: Weights; onChange: (c: Criterion, v: number) => void }) {
  return (
    <fieldset>
      <legend>{t('find8.weights')}</legend>
      {CRITERIA.map((c) => (
        <label key={c} className="choice">
          <span>{t(`find8.criterion.${c}` as StringKey)}</span>
          <input type="number" min={0} max={WEIGHT_MAX} step={1} value={weights[c]} onChange={(e) => onChange(c, Math.round(Number(e.target.value) || 0))} />
        </label>
      ))}
    </fieldset>
  )
}

/** A weighted comparison as the server calculated it: a score for each sailing, what each criterion looks like, and which sailing wins for each thing the guest might value. */
export function ComparisonResult({ comparison, nameOf }: { comparison: Comparison; nameOf: (id: string) => string }) {
  return (
    <section aria-labelledby="find8-res-h">
      <h3 id="find8-res-h">{t('find8.result')}</h3>
      <div className="table-scroll">
        <table className="compare-table">
          <caption>{t('find8.caption')}</caption>
          <thead>
            <tr>
              <th scope="col"><span className="visually-hidden">{t('cat.compare.fact')}</span></th>
              {comparison.rows.map((r) => <th key={r.sailingId} scope="col"><Link to={`/home/sailings/${r.sailingId}`}>{r.title}</Link></th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{t('find8.score')}</th>
              {comparison.rows.map((r) => <td key={r.sailingId}>{r.score === null ? t('find8.noScore') : `${r.score}/100`}</td>)}
            </tr>
            {CRITERIA.map((c) => (
              <tr key={c}>
                <th scope="row">{t(`find8.criterion.${c}` as StringKey)}</th>
                {comparison.rows.map((r) => <td key={r.sailingId}>{r.cells.find((x) => x.key === c)?.text ?? t('find8.noData.cell')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul>{comparison.ifYouValue.map((v) => <li key={v.criterion}>{t('find8.ifYouValue', { what: v.label, which: v.sailingIds.map(nameOf).join(' / ') })}</li>)}</ul>
      {comparison.rows.some((r) => r.missing.length > 0) && <ul>{comparison.rows.filter((r) => r.missing.length > 0).map((r) => <li key={r.sailingId}>{t('find8.missing', { sailing: r.title, list: r.missing.join(', ') })}</li>)}</ul>}
      <details>
        <summary>{t('find8.ports')}</summary>
        {comparison.rows.map((r) => <div key={r.sailingId}><h4>{r.title}</h4><ul>{r.portNotes.map((n) => <li key={n}>{n}</li>)}</ul></div>)}
      </details>
      <p className="muted">{comparison.priceBasis}</p>
      <p className="muted">{comparison.note}</p>
    </section>
  )
}

/** Weights for the sailings picked on the saved-sailings compare screen. The server scores them from the catalogue; nothing is worked out or kept here. */
export function WeightedCompare({ ids }: { ids: string[] }) {
  const [weights, setWeights] = useState<Weights>(defaultWeights())
  const [result, setResult] = useState<{ key: string; comparison: Comparison } | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const key = ids.join('|')
  const go = async () => {
    setBusy(true); setFailed(false)
    try {
      const comparison = normalizeComparison(await stanleyDiscover.compare(ids, weights, {}))
      if (comparison) setResult({ key, comparison }); else setFailed(true)
    } catch { setFailed(true) } finally { setBusy(false) }
  }
  // A result is for the sailings it was asked about; change the pick or a weight and it is no longer shown.
  const shown = result && result.key === key ? result.comparison : null
  const titleOf = (id: string) => shown?.rows.find((r) => r.sailingId === id)?.title ?? id
  return (
    <section aria-labelledby="cmpw-h">
      <h3 id="cmpw-h">{t('cat.saved.weigh')}</h3>
      <p>{t('cat.saved.weighBody')}</p>
      <WeightFields weights={weights} onChange={(c, v) => { setWeights({ ...weights, [c]: Math.min(WEIGHT_MAX, Math.max(0, v)) }); setResult(null) }} />
      <Button onClick={() => void go()} disabled={busy}>{t('find8.compareNow')}</Button>
      <div role="status">{failed && <p>{t('find8.failed')}</p>}</div>
      {shown && <ComparisonResult comparison={shown} nameOf={titleOf} />}
    </section>
  )
}
