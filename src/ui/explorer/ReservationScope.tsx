import { useId } from 'react'
import type { ReservationScope as Scope } from '../../domain/explorer/reservationsByDay'
import { t } from '../../i18n'

/** The two-option control over "Your reservations": the chosen day, or every day of the trip. A radio group, so the arrow keys move between the two. */
export function ReservationScope({ scope, onChange }: { scope: Scope; onChange: (next: Scope) => void }) {
  const name = useId()
  return (
    <fieldset className="exp-scope">
      <legend>{t('exp.scope.legend')}</legend>
      {(['day', 'trip'] as const).map((s) => (
        <label key={s} className="choice">
          <input type="radio" name={name} checked={scope === s} onChange={() => onChange(s)} />
          <span>{t(s === 'day' ? 'exp.scope.day' : 'exp.scope.trip')}</span>
        </label>
      ))}
    </fieldset>
  )
}
