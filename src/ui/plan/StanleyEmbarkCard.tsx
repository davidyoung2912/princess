import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizeEmbark, type Embark } from '../../ai/stanleyEmbark'
import { t, th } from '../../i18n'
import { stanleyEmbark } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'

/**
 * The Manage and Embark pack (phase P9c): check-in, phone and card, and muster. Read-only; nothing is filled in or sent. The server works out every word.
 */
export function StanleyEmbarkCard() {
  const [result, setResult] = useState<Embark | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const live = useRef(true)

  const read = useCallback(() => stanleyEmbark.get().then(
    (raw) => { if (live.current) { const next = normalizeEmbark(raw); setResult(next); setFailed(next === null); setBusy(false) } },
    () => { if (live.current) { setFailed(true); setBusy(false) } },
  ), [])

  useEffect(() => {
    live.current = true
    void read()
    return () => { live.current = false }
  }, [read])

  return (
    <Card labelledBy="embark-h">
      <h2 id="embark-h" className="card__title">{th('stanleyEmbark.title')}</h2>
      <p>{t('stanleyEmbark.intro')}</p>
      <div aria-live="polite">
        {busy && !result && <p role="status">{t('stanleyEmbark.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyEmbark.error')}</p>}
        {result && !result.hasTrip && <p>{t('stanleyEmbark.noTrip')}</p>}
        {result?.hasTrip && result.findings.length === 0 && <p role="status">{t('stanleyEmbark.clear')}</p>}
      </div>
      {result?.hasTrip && result.findings.length > 0 && (
        <ul className="stack">
          {result.findings.map((x) => (
            <li key={x.id}>
              <p><strong>{x.title}</strong></p>
              <p>{x.detail}</p>
              <Link className="button button--secondary" to={x.route}>{t('stanleyEmbark.open')}</Link>
            </li>
          ))}
        </ul>
      )}
      {result?.hasTrip && result.notChecked.length > 0 && (
        <section aria-labelledby="embark-not">
          <h3 id="embark-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{result.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
      <div className="button-row"><Button variant="secondary" onClick={() => { setBusy(true); void read() }} disabled={busy}>{t('stanleyCheckup.retry')}</Button></div>
    </Card>
  )
}
