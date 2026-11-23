import { t } from '../i18n'
import { Check } from './icons'

export type StepState = 'done' | 'current' | 'todo'

export interface StepDef {
  id: string
  label: string
  state: StepState
}

/** Progress through a multi-step task such as check-in: what is done, what is next, and what is left. */
export function Stepper({ steps, label }: { steps: readonly StepDef[]; label: string }) {
  const done = steps.filter((s) => s.state === 'done').length
  return (
    <div>
      <p className="stepper__summary">{t('stepper.summary', { done, total: steps.length })}</p>
      <ol className="stepper" aria-label={label}>
        {steps.map((s, i) => (
          <li key={s.id} className={`stepper__step stepper__step--${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
            <span className="stepper__mark" aria-hidden="true">{s.state === 'done' ? <Check /> : i + 1}</span>
            <span>
              {s.label}
              <span className="visually-hidden">{`, ${t(`stepper.state.${s.state}`)}`}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
