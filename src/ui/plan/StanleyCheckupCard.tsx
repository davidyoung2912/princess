import { Link } from 'react-router'
import { isUrgent, whenText } from '../../ai/stanleyCheckup'
import { useStanleyCheckup } from '../../hooks/useStanleyCheckup'
import { t, th } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'

/**
 * The trip check-up (phase P3): ranked findings from the trip and the plan, each with a link to the screen where it is put right, the dates that can cost money or access, and what could not be checked.
 * It never changes anything; the server works out every word.
 */
export function StanleyCheckupCard() {
  const { result, failed, busy, check } = useStanleyCheckup()
  return (
    <Card labelledBy="checkup-h">
      <h2 id="checkup-h" className="card__title">{th('stanleyCheckup.title')}</h2>
      <p>{t('stanleyCheckup.intro')}</p>
      <div aria-live="polite">
        {busy && !result && <p role="status">{t('stanleyCheckup.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyCheckup.error')}</p>}
        {result && !result.hasTrip && <p>{t('stanleyCheckup.noTrip')}</p>}
        {result?.hasTrip && result.clean && <p role="status">{t('stanleyCheckup.clean')}</p>}
      </div>
      {result?.hasTrip && result.findings.length > 0 && (
        <section aria-labelledby="checkup-found">
          <h3 id="checkup-found">{th('stanleyCheckup.found')}</h3>
          <ul className="stack">
            {result.findings.map((f) => (
              <li key={f.id}>
                <strong>{f.title}</strong>
                {isUrgent(f) && <> <span className="badge">{t('stanleyCheckup.urgent')}</span></>}
                {f.day !== null && <span className="muted"> · {t('stanleyCheckup.day', { count: f.day })}</span>}
                <p>{f.detail}</p>
                <Link className="button button--secondary" to={f.fix.route}>{f.fix.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result?.hasTrip && (
        <section aria-labelledby="checkup-dates">
          <h3 id="checkup-dates">{th('stanleyCheckup.dates')}</h3>
          {result.deadlines.length === 0 ? <p>{t('stanleyCheckup.datesNone')}</p> : (
            <ul>
              {result.deadlines.map((d) => {
                const w = whenText(d.daysLeft)
                return <li key={d.id}>{d.title}: <time dateTime={d.date}>{d.date}</time>, {t(`stanleyCheckup.${w.key}`, { count: w.count })}. <Link to={d.fix.route}>{d.fix.label}</Link></li>
              })}
            </ul>
          )}
        </section>
      )}
      {result?.hasTrip && result.notChecked.length > 0 && (
        <section aria-labelledby="checkup-not">
          <h3 id="checkup-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{result.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
      <div className="button-row"><Button variant="secondary" onClick={() => { void check() }} disabled={busy}>{t('stanleyCheckup.retry')}</Button></div>
    </Card>
  )
}
