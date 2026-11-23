import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizePrebook, type Prebook } from '../../stanley/logic/stanleyPrebook'
import { t, th } from '../../../shared/i18n'
import { stanleyPrebook } from '../../../app/runtime'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'

/**
 * The Manage and Prebook pack (phase P9b): what to expect before sailing and a dinner poll for a larger party. Read-only; nothing is started or sent. The server works out every word.
 */
export function StanleyPrebookCard() {
  const [result, setResult] = useState<Prebook | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const live = useRef(true)

  const read = useCallback(() => stanleyPrebook.get().then(
    (raw) => { if (live.current) { const next = normalizePrebook(raw); setResult(next); setFailed(next === null); setBusy(false) } },
    () => { if (live.current) { setFailed(true); setBusy(false) } },
  ), [])

  useEffect(() => {
    live.current = true
    void read()
    return () => { live.current = false }
  }, [read])

  return (
    <Card labelledBy="prebook-h">
      <h2 id="prebook-h" className="card__title">{th('stanleyPrebook.title')}</h2>
      <p>{t('stanleyPrebook.intro')}</p>
      <div aria-live="polite">
        {busy && !result && <p role="status">{t('stanleyPrebook.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyPrebook.error')}</p>}
        {result && !result.hasTrip && <p>{t('stanleyPrebook.noTrip')}</p>}
        {result?.hasTrip && result.findings.length === 0 && <p role="status">{t('stanleyPrebook.clear')}</p>}
      </div>
      {result?.hasTrip && result.findings.length > 0 && (
        <ul className="stack">
          {result.findings.map((x) => (
            <li key={x.id}>
              <p><strong>{x.title}</strong></p>
              <p>{x.detail}</p>
              <Link className="button button--secondary" to={x.route}>{t('stanleyPrebook.open')}</Link>
            </li>
          ))}
        </ul>
      )}
      {result?.hasTrip && result.notChecked.length > 0 && (
        <section aria-labelledby="prebook-not">
          <h3 id="prebook-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{result.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
      <div className="button-row"><Button variant="secondary" onClick={() => { setBusy(true); void read() }} disabled={busy}>{t('stanleyCheckup.retry')}</Button></div>
    </Card>
  )
}
