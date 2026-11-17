import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizeFamily, type Family } from '../../ai/stanleyFamily'
import { t, th } from '../../i18n'
import { stanleyFamily } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'

/**
 * The Family pack (phase P9e): kids club and muster for everyone. Read-only; nothing is filled in or sent. The server works out every word.
 */
export function StanleyFamilyCard() {
  const [result, setResult] = useState<Family | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const live = useRef(true)

  const read = useCallback(() => stanleyFamily.get().then(
    (raw) => { if (live.current) { const next = normalizeFamily(raw); setResult(next); setFailed(next === null); setBusy(false) } },
    () => { if (live.current) { setFailed(true); setBusy(false) } },
  ), [])

  useEffect(() => {
    live.current = true
    void read()
    return () => { live.current = false }
  }, [read])

  return (
    <Card labelledBy="family-h">
      <h2 id="family-h" className="card__title">{th('stanleyFamily.title')}</h2>
      <p>{t('stanleyFamily.intro')}</p>
      <div aria-live="polite">
        {busy && !result && <p role="status">{t('stanleyFamily.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyFamily.error')}</p>}
        {result && !result.hasTrip && <p>{t('stanleyFamily.noTrip')}</p>}
        {result?.hasTrip && result.findings.length === 0 && <p role="status">{t('stanleyFamily.clear')}</p>}
      </div>
      {result?.hasTrip && result.findings.length > 0 && (
        <ul className="stack">
          {result.findings.map((x) => (
            <li key={x.id}>
              <p><strong>{x.title}</strong></p>
              <p>{x.detail}</p>
              <Link className="button button--secondary" to={x.route}>{t('stanleyFamily.open')}</Link>
            </li>
          ))}
        </ul>
      )}
      {result?.hasTrip && result.notChecked.length > 0 && (
        <section aria-labelledby="family-not">
          <h3 id="family-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{result.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
      <div className="button-row"><Button variant="secondary" onClick={() => { setBusy(true); void read() }} disabled={busy}>{t('stanleyCheckup.retry')}</Button></div>
    </Card>
  )
}
