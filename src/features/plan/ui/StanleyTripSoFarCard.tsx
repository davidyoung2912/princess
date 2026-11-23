import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { PACES, type Pace } from '../../stanley/logic/stanleyStanding'
import { normalizeTripSoFar, type TripSoFar } from '../../stanley/logic/stanleyTripSoFar'
import { t, th } from '../../../shared/i18n'
import { stanleyTripSoFar } from '../../../app/runtime'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'

/**
 * Stanley's trip so far (phase P9a): honest counts from the activity list and, after three yeses or two undos of one kind, a question about how much he does. Read-only: a suggestion only opens a screen and changes nothing.
 * The server works out every word and number.
 */
export function StanleyTripSoFarCard() {
  const [result, setResult] = useState<TripSoFar | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const [saved, setSaved] = useState<Pace | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
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
      {result?.enabled && result.confirmed > 0 && (
        <fieldset className="stack" aria-describedby="tripsofar-pace-hint">
          <legend>{t('stanleyTrip.pace')}</legend>
          <p id="tripsofar-pace-hint">{t('stanleyTrip.paceHint')}</p>
          <div className="button-row">
            {PACES.map((p) => (
              <Button key={p} variant={(saved ?? result.pace) === p ? 'primary' : 'secondary'} aria-pressed={(saved ?? result.pace) === p} disabled={busy}
                onClick={() => { setSaveFailed(false); stanleyTripSoFar.answer(p).then(() => { setSaved(p); void read() }, () => setSaveFailed(true)) }}>
                {t(`stanleyTrip.pace.${p}`)}
              </Button>
            ))}
          </div>
          {saveFailed && <p role="alert" className="field__error">{t('stanleyTrip.paceError')}</p>}
        </fieldset>
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
