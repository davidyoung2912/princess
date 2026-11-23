import { Link } from 'react-router'
import { forRule, isUrgent, RULE_GROUPS, type RuleGroup } from '../../stanley/logic/stanleyValue'
import { useStanleyValue } from '../../../shared/hooks/useStanleyValue'
import { t, th } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'

/**
 * Value and bill (phase P6): charges worth a second look, what the guest already has and has not used, and a packing nudge before sailing. Read-only: each item opens the screen where it is dealt with.
 * The server works out every word.
 */
export function StanleyValueCard() {
  const { result, failed, busy, check } = useStanleyValue()
  return (
    <Card labelledBy="value-h">
      <h2 id="value-h" className="card__title">{th('stanleyValue.title')}</h2>
      <p>{t('stanleyValue.intro')}</p>
      <div aria-live="polite">
        {busy && !result && <p role="status">{t('stanleyValue.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('stanleyValue.error')}</p>}
        {result && !result.hasTrip && <p>{t('stanleyValue.noTrip')}</p>}
        {result?.hasTrip && result.clean && <p role="status">{t('stanleyValue.clean')}</p>}
      </div>
      {result?.hasTrip && RULE_GROUPS.map((rule: RuleGroup) => {
        const items = forRule(result.findings, rule)
        if (items.length === 0) return null
        return (
          <section key={rule} aria-labelledby={`value-${rule}`}>
            <h3 id={`value-${rule}`}>{th(`stanleyValue.group.${rule}`)}</h3>
            <ul className="stack">
              {items.map((f) => (
                <li key={f.id}>
                  <strong>{f.title}</strong>
                  {isUrgent(f) && <> <span className="badge">{t('stanleyCheckup.urgent')}</span></>}
                  <p>{f.detail}</p>
                  <Link className="button button--secondary" to={f.fix.route}>{f.fix.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {result?.hasTrip && result.notChecked.length > 0 && (
        <section aria-labelledby="value-not">
          <h3 id="value-not">{th('stanleyCheckup.notChecked')}</h3>
          <ul>{result.notChecked.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}
      <div className="button-row"><Button variant="secondary" onClick={() => { void check() }} disabled={busy}>{t('stanleyCheckup.retry')}</Button></div>
    </Card>
  )
}
