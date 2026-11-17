import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizePlanning, type Planning } from '../../ai/stanleyPlanningPack'
import { t, th } from '../../i18n'
import { stanleyPlanningPack } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'

/**
 * The Dream, Discover and Book pack (phase P9f): saved sailings, cabins, decision, cost and booking. Read-only; nothing is filled in or sent. The server works out every word.
 */
export function StanleyPlanningCard() {
  const [result, setResult] = useState<Planning | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const live = useRef(true)

  const read = useCallback(() => stanleyPlanningPack.get().then(
    (raw) => { if (live.current) { const next = normalizePlanning(raw); setResult(next); setFailed(next === null); setBusy(false) } },
    () => { if (live.current) { setFailed(true); setBusy(false) } },
  ), [])

  useEffect(() => {
    live.current = true
    void read()
    return () => { live.current = false }
  }, [read])

  return (
    <Card labelledBy="planning-h">
      <h2 id="planning-h" className="card__title">{th('stanleyPlanningPack.title')}</h2>
      <p>{t('stanleyPlanningPack.intro')}</p>
      <div aria-live="polite">
        {busy && !result && <p role="status">{t('stanleyPlanningPack.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyPlanningPack.error')}</p>}
        {result && !result.planning && <p>{t('stanleyPlanningPack.noTrip')}</p>}
        {result?.planning && result.findings.length === 0 && <p role="status">{t('stanleyPlanningPack.clear')}</p>}
      </div>
      {result?.planning && result.findings.length > 0 && (
        <ul className="stack">
          {result.findings.map((x) => (
            <li key={x.id}>
              <p><strong>{x.title}</strong></p>
              <p>{x.detail}</p>
              <Link className="button button--secondary" to={x.route}>{t('stanleyPlanningPack.open')}</Link>
            </li>
          ))}
        </ul>
      )}
      {result?.planning && result.notChecked.length > 0 && (
        <section aria-labelledby="planning-not">
          <h3 id="planning-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{result.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
      <div className="button-row"><Button variant="secondary" onClick={() => { setBusy(true); void read() }} disabled={busy}>{t('stanleyCheckup.retry')}</Button></div>
    </Card>
  )
}
