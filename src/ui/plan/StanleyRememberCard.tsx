import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizeRemember, type Remember } from '../../ai/stanleyRememberPack'
import { t, th } from '../../i18n'
import { stanleyRememberPack } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'

/**
 * The Remember pack (phase P9f): recap, feedback and loyalty. Read-only; nothing is filled in or sent. The server works out every word.
 */
export function StanleyRememberCard() {
  const [result, setResult] = useState<Remember | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const live = useRef(true)

  const read = useCallback(() => stanleyRememberPack.get().then(
    (raw) => { if (live.current) { const next = normalizeRemember(raw); setResult(next); setFailed(next === null); setBusy(false) } },
    () => { if (live.current) { setFailed(true); setBusy(false) } },
  ), [])

  useEffect(() => {
    live.current = true
    void read()
    return () => { live.current = false }
  }, [read])

  return (
    <Card labelledBy="remember-h">
      <h2 id="remember-h" className="card__title">{th('stanleyRememberPack.title')}</h2>
      <p>{t('stanleyRememberPack.intro')}</p>
      <div aria-live="polite">
        {busy && !result && <p role="status">{t('stanleyRememberPack.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyRememberPack.error')}</p>}
        {result && !result.hasTrip && <p>{t('stanleyRememberPack.noTrip')}</p>}
        {result?.hasTrip && result.findings.length === 0 && <p role="status">{t('stanleyRememberPack.clear')}</p>}
      </div>
      {result?.hasTrip && result.findings.length > 0 && (
        <ul className="stack">
          {result.findings.map((x) => (
            <li key={x.id}>
              <p><strong>{x.title}</strong></p>
              <p>{x.detail}</p>
              <Link className="button button--secondary" to={x.route}>{t('stanleyRememberPack.open')}</Link>
            </li>
          ))}
        </ul>
      )}
      {result?.hasTrip && result.notChecked.length > 0 && (
        <section aria-labelledby="remember-not">
          <h3 id="remember-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{result.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
      <div className="button-row"><Button variant="secondary" onClick={() => { setBusy(true); void read() }} disabled={busy}>{t('stanleyCheckup.retry')}</Button></div>
    </Card>
  )
}
