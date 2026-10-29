import { fareIncludes, FARES } from '../../domain/fares'
import { formatMoney } from '../../domain/pricing'
import { api } from '../../runtime'
import { useAsync } from '../../hooks/useAsync'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { PriceState } from '../discover/parts'
import { ChoiceError } from './ChoiceError'
import { StepSection, type StepProps } from './common'

/** Step 3: the fares side by side, each with what it includes and what it adds to the total (BOK-04). */
export function FareStep({ draft, update, error }: StepProps) {
  const fares = useAsync(() => api.booking.fares(draft), [draft.sailingId, draft.category, draft.guests])
  return (
    <StepSection title={t('book.fare.title')} intro={t('book.fare.intro', { count: draft.guests })}>
      <PriceState state={fares}>
        {fares.data && (
          <fieldset>
            <legend>{t('book.fare.legend')}</legend>
            {fares.data.some((f) => f.included) && <Banner kind="info" title={t('book.fare.suite')} />}
            <ul className="fare-grid">
              {fares.data.map((f) => (
                <li key={f.id} className={`card fare${draft.fare === f.id ? ' fare--chosen' : ''}`}>
                  <label className="choice choice--top">
                    <input type="radio" name="fare" value={f.id} checked={draft.fare === f.id} onChange={() => update((d) => ({ ...d, fare: f.id }))} />
                    <span>
                      <strong>{FARES[f.id].name}</strong>
                      <small>{FARES[f.id].tagline}</small>
                    </span>
                  </label>
                  <p className="fare__total">{formatMoney(f.total)}<span className="muted"> {t('book.fare.allIn', { count: draft.guests })}</span></p>
                  <p>
                    {f.included ? <span className="tag tag--good">{t('book.fare.includedInRoom')}</span> : f.difference === 0 ? <span className="tag">{t('book.fare.lowest')}</span> : <span className="tag">{t('book.fare.more', { amount: formatMoney(f.difference) })}</span>}
                  </p>
                  <ul className="plain-bullets">{fareIncludes(f.id).map((line) => <li key={line}>{line}</li>)}</ul>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </PriceState>
      <ChoiceError text={error('fare')} />
      <p className="muted">{t('book.fare.note')}</p>
    </StepSection>
  )
}
