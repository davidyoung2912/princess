import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizeDisembark, type Disembark } from '../../stanley/logic/stanleyDisembark'
import { t, th } from '../../../shared/i18n'
import { stanleyDisembark } from '../../../app/runtime'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'

/**
 * The Manage and Disembark pack (phase P9d): check-in, phone and card, and muster. Read-only; nothing is filled in or sent. The server works out every word.
 */
export function StanleyDisembarkCard() {
  const [result, setResult] = useState<Disembark | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const live = useRef(true)

  const read = useCallback(() => stanleyDisembark.get().then(
    (raw) => { if (live.current) { const next = normalizeDisembark(raw); setResult(next); setFailed(next === null); setBusy(false) } },
    () => { if (live.current) { setFailed(true); setBusy(false) } },
  ), [])

  useEffect(() => {
    live.current = true
    void read()
    return () => { live.current = false }
  }, [read])

  return (
    <Card labelledBy="disembark-h">
      <h2 id="disembark-h" className="card__title">{th('stanleyDisembark.title')}</h2>
      <p>{t('stanleyDisembark.intro')}</p>
      <div aria-live="polite">
        {busy && !result && <p role="status">{t('stanleyDisembark.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyDisembark.error')}</p>}
        {result && !result.hasTrip && <p>{t('stanleyDisembark.noTrip')}</p>}
        {result?.hasTrip && result.findings.length === 0 && <p role="status">{t('stanleyDisembark.clear')}</p>}
      </div>
      {result?.hasTrip && result.findings.length > 0 && (
        <ul className="stack">
          {result.findings.map((x) => (
            <li key={x.id}>
              <p><strong>{x.title}</strong></p>
              <p>{x.detail}</p>
              <Link className="button button--secondary" to={x.route}>{t('stanleyDisembark.open')}</Link>
            </li>
          ))}
        </ul>
      )}
      {result?.hasTrip && result.notChecked.length > 0 && (
        <section aria-labelledby="disembark-not">
          <h3 id="disembark-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{result.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
      <div className="button-row"><Button variant="secondary" onClick={() => { setBusy(true); void read() }} disabled={busy}>{t('stanleyCheckup.retry')}</Button></div>
    </Card>
  )
}
