import { useId, useState } from 'react'
import { normalizeTourCompare, type TourCompare } from '../../ai/stanleyPlanner'
import { EXCURSIONS } from '../../domain/excursions'
import { t, th, type StringKey } from '../../i18n'
import { stanleyPlanner } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'

/**
 * Compare two excursions side by side (phase 9): duration, exertion, transport, getting back, the price for the party, what is included and step-free access, with the risks for the people travelling and what the
 * listing does not say. Everything comes from the server; nothing is booked from here.
 */
export function StanleyTourCompare({ sailingId }: { sailingId: string }) {
  const ids = useId()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [result, setResult] = useState<TourCompare | null>(null)
  const [failed, setFailed] = useState(false)
  const go = async () => {
    setFailed(false); setResult(null)
    try { setResult(normalizeTourCompare(await stanleyPlanner.compareTours({ sailingId, a, b }))) } catch { setFailed(true) }
  }
  const options = (skip: string) => EXCURSIONS.filter((x) => x.id !== skip).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)
  return (
    <Card labelledBy={`${ids}-h`}>
      <h2 id={`${ids}-h`} className="card__title">{th('cmp9.title')}</h2>
      <p>{t('cmp9.intro')}</p>
      <div className="field">
        <label htmlFor={`${ids}-a`}>{t('cmp9.first')}</label>
        <select id={`${ids}-a`} className="field__input" value={a} onChange={(e) => setA(e.target.value)}><option value="">{t('cmp9.choose')}</option>{options(b)}</select>
        <label htmlFor={`${ids}-b`}>{t('cmp9.second')}</label>
        <select id={`${ids}-b`} className="field__input" value={b} onChange={(e) => setB(e.target.value)}><option value="">{t('cmp9.choose')}</option>{options(a)}</select>
      </div>
      <Button variant="secondary" onClick={() => void go()} disabled={!a || !b}>{t('cmp9.go')}</Button>
      <div role="status">
        {failed && <p>{t('cmp9.failed')}</p>}
        {result && (
          <>
            <table className="compare-table">
              <caption className="visually-hidden">{result.nameA} / {result.nameB}</caption>
              <thead><tr><th scope="col">{t('cmp9.row')}</th><th scope="col">{result.nameA}</th><th scope="col">{result.nameB}</th></tr></thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.key}><th scope="row">{t(`cmp9.row.${r.key}` as StringKey)}</th><td>{r.a}</td><td>{r.b}</td></tr>
                ))}
              </tbody>
            </table>
            {result.risks.length > 0 && <><h3>{t('cmp9.risks')}</h3><ul>{result.risks.map((x) => <li key={x}>{x}</li>)}</ul></>}
            {result.missing.length > 0 && <><h3>{t('cmp9.missing')}</h3><ul>{result.missing.map((x) => <li key={x}>{x}</li>)}</ul></>}
          </>
        )}
      </div>
    </Card>
  )
}
