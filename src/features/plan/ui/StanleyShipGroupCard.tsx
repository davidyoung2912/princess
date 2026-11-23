import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizeShipGroup, type ShipGroup } from '../../stanley/logic/stanleyShipGroup'
import { t, th } from '../../../shared/i18n'
import { stanleyShipGroup } from '../../../app/runtime'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'

/**
 * The missed-ship guard and group gaps (phase P8): how long until the way back for a guest who is ashore, and how many have not answered a poll. Read-only; nothing is sent. The server works out every word,
 * and the severity is written in words so it never depends on colour.
 */
export function StanleyShipGroupCard() {
  const [result, setResult] = useState<ShipGroup | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const live = useRef(true)

  const read = useCallback(() => stanleyShipGroup.get().then(
    (raw) => { if (live.current) { const next = normalizeShipGroup(raw); setResult(next); setFailed(next === null); setBusy(false) } },
    () => { if (live.current) { setFailed(true); setBusy(false) } },
  ), [])

  useEffect(() => {
    live.current = true
    void read()
    return () => { live.current = false }
  }, [read])

  return (
    <Card labelledBy="shipgroup-h">
      <h2 id="shipgroup-h" className="card__title">{th('stanleyShipGroup.title')}</h2>
      <p>{t('stanleyShipGroup.intro')}</p>
      <div aria-live="polite">
        {busy && !result && <p role="status">{t('stanleyShipGroup.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyShipGroup.error')}</p>}
        {result && !result.hasTrip && <p>{t('stanleyShipGroup.noTrip')}</p>}
        {result?.hasTrip && result.clear && result.findings.length === 0 && <p role="status">{t('stanleyShipGroup.clear')}</p>}
      </div>
      {result?.hasTrip && result.findings.length > 0 && (
        <ul className="stack">
          {result.findings.map((x) => (
            <li key={x.id}>
              <p><strong>{t(`stanleyShipGroup.${x.severity}`)}: {x.title}</strong></p>
              <p>{x.detail}</p>
              <Link className="button button--secondary" to={x.route}>{t('stanleyShipGroup.open')}</Link>
            </li>
          ))}
        </ul>
      )}
      {result?.hasTrip && result.notChecked.length > 0 && (
        <section aria-labelledby="shipgroup-not">
          <h3 id="shipgroup-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{result.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
      <div className="button-row"><Button variant="secondary" onClick={() => { setBusy(true); void read() }} disabled={busy}>{t('stanleyCheckup.retry')}</Button></div>
    </Card>
  )
}
