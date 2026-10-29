import { useEffect } from 'react'
import { NEEDS, type NeedId } from '../../domain/account'
import { fillBlank, GENDERS, type GuestDraft, type LeadContact } from '../../domain/booking'
import { sailingById } from '../../domain/sailings'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Field } from '../Field'
import { StepSection, type StepProps } from './common'

const toggle = <T,>(list: readonly T[], item: T, on: boolean): T[] => (on ? [...list.filter((x) => x !== item), item] : list.filter((x) => x !== item))

/** Step 4: who is travelling (BOK-02). Names are as on the passport; guests start from the account and can be changed. */
export function GuestsStep({ draft, update, error, ctx }: StepProps) {
  const departure = sailingById(draft.sailingId)?.departure
  // Start from the account (ACT-03), without overwriting anything already entered.
  useEffect(() => {
    let current = true
    api.booking.prefill().then((p) => { if (current) update((d) => fillBlank(d, p)) }, () => {})
    return () => { current = false }
  }, [update])

  const setGuest = (i: number, patch: Partial<GuestDraft>) => update((d) => ({ ...d, people: d.people.map((g, j) => (j === i ? { ...g, ...patch } : g)) }))
  const setContact = (patch: Partial<LeadContact>) => update((d) => ({ ...d, contact: { ...d.contact, ...patch } }))
  const contactField = (f: keyof LeadContact, label: StringKey, extra: { autoComplete?: string; type?: string; inputMode?: 'tel' | 'email' } = {}) => (
    <Field label={t(label)} value={draft.contact[f]} error={error(`contact.${f}`)} onChange={(e) => setContact({ [f]: e.target.value })} {...extra} />
  )

  return (
    <StepSection title={t('book.guests.title')} intro={t('book.guests.intro')}>
      <p className="muted">{t('book.guests.scan')}</p>
      {error('people') && <p className="field__error">{error('people')}</p>}
      {draft.people.map((g, i) => (
        <fieldset key={i}>
          <legend>{i === 0 ? t('book.guests.lead') : t('book.guests.guestN', { n: i + 1 })}</legend>
          <Field label={t('book.field.firstName')} hint={i === 0 ? t('book.guests.nameHint') : undefined} value={g.firstName} error={error(`people.${i}.firstName`)} onChange={(e) => setGuest(i, { firstName: e.target.value })} autoComplete={i === 0 ? 'given-name' : 'off'} />
          <Field label={t('book.field.lastName')} value={g.lastName} error={error(`people.${i}.lastName`)} onChange={(e) => setGuest(i, { lastName: e.target.value })} autoComplete={i === 0 ? 'family-name' : 'off'} />
          <Field label={t('book.field.dob')} hint={t('book.guests.dobHint')} type="date" max={ctx.today} value={g.dob} error={error(`people.${i}.dob`)} onChange={(e) => setGuest(i, { dob: e.target.value })} autoComplete={i === 0 ? 'bday' : 'off'} />
          <div className="field">
            <label htmlFor={`gender-${i}`}>{t('book.field.gender')}</label>
            <p className="field__hint">{t('book.guests.genderHint')}</p>
            <select id={`gender-${i}`} value={g.gender} aria-invalid={error(`people.${i}.gender`) ? true : undefined} onChange={(e) => setGuest(i, { gender: e.target.value as GuestDraft['gender'] })}>
              <option value="">{t('book.choose')}</option>
              {GENDERS.map((x) => <option key={x} value={x}>{t(`book.gender.${x}` as StringKey)}</option>)}
            </select>
            {error(`people.${i}.gender`) && <p className="field__error">{error(`people.${i}.gender`)}</p>}
          </div>
          <div className="field">
            <label htmlFor={`citizen-${i}`}>{t('book.field.citizenship')}</label>
            <select id={`citizen-${i}`} value={g.citizenship} aria-invalid={error(`people.${i}.citizenship`) ? true : undefined} onChange={(e) => setGuest(i, { citizenship: e.target.value as GuestDraft['citizenship'] })}>
              <option value="">{t('book.choose')}</option>
              <option value="us">{t('book.citizenship.us')}</option>
              <option value="other">{t('book.citizenship.other')}</option>
            </select>
            {error(`people.${i}.citizenship`) && <p className="field__error">{error(`people.${i}.citizenship`)}</p>}
          </div>
          <fieldset className="plain-fieldset">
            <legend>{t('book.guests.needs')}</legend>
            <p className="field__hint">{t('book.guests.needsHint')}</p>
            {NEEDS.map((n: NeedId) => (
              <label key={n} className="choice">
                <input type="checkbox" checked={g.needs.includes(n)} onChange={(e) => setGuest(i, { needs: toggle(g.needs, n, e.target.checked) })} />
                <span>{t(`book.need.${n}` as StringKey)}</span>
              </label>
            ))}
          </fieldset>
        </fieldset>
      ))}

      <fieldset>
        <legend>{t('book.contact.title')}</legend>
        <p className="field__hint">{t('book.contact.intro')}</p>
        {contactField('email', 'book.field.email', { type: 'email', autoComplete: 'email', inputMode: 'email' })}
        {contactField('phone', 'book.field.phone', { type: 'tel', autoComplete: 'tel', inputMode: 'tel' })}
        {contactField('street', 'book.field.street', { autoComplete: 'street-address' })}
        {contactField('city', 'book.field.city', { autoComplete: 'address-level2' })}
        {contactField('region', 'book.field.region', { autoComplete: 'address-level1' })}
        {contactField('postcode', 'book.field.postcode', { autoComplete: 'postal-code' })}
        {contactField('country', 'book.field.country', { autoComplete: 'country-name' })}
      </fieldset>
      {departure && <p className="muted">{t('book.guests.ageNote')}</p>}
    </StepSection>
  )
}
