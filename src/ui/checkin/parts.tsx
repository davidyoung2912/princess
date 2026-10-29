import type { CheckinView } from '../../api/types'
import type { GuestStepId } from '../../domain/checkin'
import type { PersonaId } from '../../domain/personas'
import { t } from '../../i18n'
import { StatusBadge } from '../StatusBadge'

/** One radio per person, each showing whether this step is done for them. Hidden when only one person is travelling. */
export function GuestChooser({ view, step, value, onChange }: { view: CheckinView; step: GuestStepId; value: PersonaId; onChange: (id: PersonaId) => void }) {
  if (view.guests.length < 2) return null
  return (
    <fieldset>
      <legend>{t('checkin.whoFor')}</legend>
      {view.guests.map((g) => (
        <label key={g.id} className="choice">
          <input type="radio" name="guest" checked={g.id === value} onChange={() => onChange(g.id)} />
          <span>{g.name}{g.child ? ` (${t('plan.age', { age: g.age })})` : ''}</span>
          {g.progress.done.includes(step) ? <StatusBadge kind="booked" label={t('checkin.done')} /> : <StatusBadge kind="ready" label={t('checkin.todo')} />}
        </label>
      ))}
    </fieldset>
  )
}

/** "Do this for": one checkbox per person who has not yet done the step (all ticked), so a parent answers once for everyone. */
export function ApplyTo({ view, step, value, onChange }: { view: CheckinView; step: GuestStepId; value: readonly PersonaId[]; onChange: (next: PersonaId[]) => void }) {
  return (
    <fieldset>
      <legend>{t('checkin.applyTo')}</legend>
      {view.guests.map((g) => (
        <label key={g.id} className="choice">
          <input type="checkbox" checked={value.includes(g.id)} onChange={() => onChange(value.includes(g.id) ? value.filter((x) => x !== g.id) : [...value, g.id])} />
          <span>{g.name}{g.child ? ` (${t('plan.age', { age: g.age })})` : ''}</span>
          {g.progress.done.includes(step) && <StatusBadge kind="booked" label={t('checkin.done')} />}
        </label>
      ))}
    </fieldset>
  )
}
