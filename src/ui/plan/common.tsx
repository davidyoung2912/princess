import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { ApiError } from '../../api/errors'
import type { PartyMember } from '../../api/types'
import type { PersonaId } from '../../domain/personas'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { ActionError } from '../account/parts'

/** A change that was refused for a reason the guest can act on (a clash, a full table), in words; anything else falls back to the general wording. */
export function PlanError({ error }: { error: ApiError | null }) {
  if (!error) return null
  if (error.code === 'conflict' || error.code === 'invalid') {
    const text = t(`plan.err.${error.message}` as StringKey)
    if (text !== `plan.err.${error.message}`) return <p role="alert" className="field__error">{text}</p>
  }
  return <ActionError error={error} />
}

/** Who is going: one checkbox per person on the booking. */
export function GuestPicker({ legend, party, value, onChange, disabled, hint }: { legend: string; party: readonly PartyMember[]; value: readonly PersonaId[]; onChange: (next: PersonaId[]) => void; disabled?: boolean; hint?: string }) {
  return (
    <fieldset className="plain-fieldset">
      <legend>{legend}</legend>
      {hint && <p className="field__hint">{hint}</p>}
      {party.map((g) => (
        <label key={g.id} className="choice">
          <input type="checkbox" checked={value.includes(g.id)} disabled={disabled} onChange={() => onChange(value.includes(g.id) ? value.filter((x) => x !== g.id) : [...value, g.id])} />
          <span>{g.name}{g.child ? ` (${t('plan.age', { age: g.age })})` : ''}</span>
        </label>
      ))}
    </fieldset>
  )
}

/** The note shown to a supervised child account, which can look but not change. */
export function ReadOnly({ canDo }: { canDo: boolean }) {
  if (canDo) return null
  return <Banner kind="info" title={t('plan.readOnly.title')}><p>{t('plan.readOnly.body')}</p></Banner>
}

export function Back({ to, label }: { to: string; label: ReactNode }) {
  return <p className="book-nav"><Link to={to}>{label}</Link></p>
}
