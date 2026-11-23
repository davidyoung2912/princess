import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizeChecklist, type Checklist } from '../../stanley/logic/stanleyChecklist'
import { t, th } from '../../../shared/i18n'
import { stanleyChecklist } from '../../../app/runtime'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'

/**
 * The trip checklist (phase P5): what is outstanding for each traveller, each item a screen to open, and a remembered preference shown as a suggestion with its source. Read-only: nothing is filled in or set.
 * The server works out every word.
 */
export function StanleyChecklistCard() {
  const [result, setResult] = useState<Checklist | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const live = useRef(true)

  const read = useCallback(() => stanleyChecklist.get().then(
    (raw) => { if (live.current) { const next = normalizeChecklist(raw); setResult(next); setFailed(next === null); setBusy(false) } },
    () => { if (live.current) { setFailed(true); setBusy(false) } },
  ), [])

  useEffect(() => {
    live.current = true
    void read()
    return () => { live.current = false }
  }, [read])

  return (
    <Card labelledBy="checklist-h">
      <h2 id="checklist-h" className="card__title">{th('stanleyChecklist.title')}</h2>
      <p>{t('stanleyChecklist.intro')}</p>
      <div aria-live="polite">
        {busy && !result && <p role="status">{t('stanleyChecklist.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyChecklist.error')}</p>}
        {result && !result.hasTrip && <p>{t('stanleyChecklist.noTrip')}</p>}
        {result?.hasTrip && result.complete && <p role="status">{t('stanleyChecklist.complete')}</p>}
        {result?.hasTrip && result.total > 0 && <p>{t('stanleyChecklist.progress', { done: result.done, total: result.total })}</p>}
      </div>
      {result?.hasTrip && result.items.length > 0 && (
        <ul className="stack">
          {result.items.map((i) => (
            <li key={i.id}>
              <strong>{i.title}</strong>
              {i.default && <p>{t('stanleyChecklist.default', { label: i.default.label, source: i.default.source })}</p>}
              <Link className="button button--secondary" to={i.route}>{t('stanleyChecklist.open')}</Link>
            </li>
          ))}
        </ul>
      )}
      {result?.hasTrip && result.notChecked.length > 0 && (
        <section aria-labelledby="checklist-not">
          <h3 id="checklist-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{result.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
      <div className="button-row"><Button variant="secondary" onClick={() => { setBusy(true); void read() }} disabled={busy}>{t('stanleyCheckup.retry')}</Button></div>
    </Card>
  )
}
