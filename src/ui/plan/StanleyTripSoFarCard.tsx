import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizeTripSoFar, type TripSoFar } from '../../ai/stanleyTripSoFar'
import { t, th } from '../../i18n'
import { stanleyTripSoFar } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'

/**
 * Stanley's trip so far (phase P9a): honest counts from the activity list and, after three yeses or two undos of one kind, a question about how much he does. Read-only: a suggestion only opens a screen and changes nothing.
 * The server works out every word and number.
 */
export function StanleyTripSoFarCard() {
  const [result, setResult] = useState<TripSoFar | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const live = useRef(true)

  const read = useCallback(() => stanleyTripSoFar.get().then(
    (raw) => { if (live.current) { const next = normalizeTripSoFar(raw); setResult(next); setFailed(next === null); setBusy(false) } },
    () => { if (live.current) { setFailed(true); setBusy(false) } },
  ), [])

  useEffect(() => {
    live.current = true
    void read()
    return () => { live.current = false }
  }, [read])

  return (
    <Card labelledBy="tripsofar-h">
      <h2 id="tripsofar-h" className="card__title">{th('stanleyTrip.title')}</h2>
      <p>{t('stanleyTrip.intro')}</p>
      <div aria-live="polite">
        {busy && !result && <p role="status">{t('stanleyTrip.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyTrip.error')}</p>}
        {result && !result.enabled && <p>{t('stanleyTrip.off')}</p>}
        {result?.enabled && result.confirmed === 0 && <p role="status">{t('stanleyTrip.none')}</p>}
      </div>
      {result?.enabled && result.confirmed > 0 && (
        <ul>
          <li>{t('stanleyTrip.confirmed', { count: result.confirmed })}</li>
          <li>{t('stanleyTrip.done', { count: result.done })}</li>
          <li>{t('stanleyTrip.undone', { count: result.undone })}</li>
        </ul>
      )}
      {result?.enabled && result.suggestions.length > 0 && (
        <section aria-labelledby="tripsofar-sug">
          <h3 id="tripsofar-sug">{th('stanleyTrip.suggestions')}</h3>
          <ul className="stack">
            {result.suggestions.map((x) => (
              <li key={x.id}>
                <p>{x.text}</p>
                <Link className="button button--secondary" to={x.route}>{t('stanleyTrip.open')}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result?.enabled && result.notMeasured.length > 0 && (
        <section aria-labelledby="tripsofar-not">
          <h3 id="tripsofar-not">{th('stanleyTrip.notMeasured')}</h3>
          <ul>{result.notMeasured.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
      <div className="button-row"><Button variant="secondary" onClick={() => { setBusy(true); void read() }} disabled={busy}>{t('stanleyCheckup.retry')}</Button></div>
    </Card>
  )
}
