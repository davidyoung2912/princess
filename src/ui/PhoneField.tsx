import { useId, useState } from 'react'
import { t } from '../i18n'
import { cleanNational, defaultPhoneCountry, formatNational, phoneCountry, PHONE_COUNTRIES, splitInternational, toE164 } from '../domain/phone'
import { FieldLabel } from './Field'
import { CircleAlert } from './icons'

interface PhoneFieldProps {
  label: string
  hint?: string
  help?: string
  error?: string
  /** The whole number as `+<code><digits>`, or empty. */
  value: string
  onChange: (e164: string) => void
}

const startCountry = (value: string): string => splitInternational(value)?.country.iso ?? defaultPhoneCountry(typeof navigator === 'undefined' ? undefined : navigator.language)

/**
 * A phone number entry: a country picker (its dial code) beside a number box that takes digits only, lays them out the way that country writes
 * them as they are typed, and stops at the longest number there. A whole number pasted with its code (`+44 7700 900123`) moves the picker to that
 * country. The form gets the number as `+<code><digits>`, or empty while nothing is typed.
 */
export function PhoneField({ label, hint, help, error, value, onChange }: PhoneFieldProps) {
  const id = useId()
  const [iso, setIso] = useState(() => startCountry(value))
  const [digits, setDigits] = useState(() => splitInternational(value)?.digits ?? '')
  const country = phoneCountry(iso)
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined

  const emit = (c: typeof country, d: string) => { setIso(c.iso); setDigits(d); onChange(toE164(c, d)) }
  const type = (text: string) => {
    const whole = splitInternational(text)
    if (whole) emit(whole.country, whole.digits)
    else emit(country, cleanNational(country, text))
  }

  return (
    <div className="field phone-field">
      <FieldLabel htmlFor={`${id}-number`} help={help}>{label}</FieldLabel>
      {hint && <p id={`${id}-hint`} className="field__hint">{hint}</p>}
      <div className="phone-field__row">
        <select className="field__input phone-field__country" aria-label={t('phone.country')} value={iso} onChange={(e) => emit(phoneCountry(e.target.value), cleanNational(phoneCountry(e.target.value), digits))}>
          {PHONE_COUNTRIES.map((p) => <option key={p.iso} value={p.iso}>{`+${p.code} ${p.name}`}</option>)}
        </select>
        <input
          id={`${id}-number`} className="field__input phone-field__number" type="tel" inputMode="tel" autoComplete="tel-national"
          value={formatNational(country, digits)} onChange={(e) => type(e.target.value)}
          aria-invalid={error ? true : undefined} aria-describedby={describedBy}
          placeholder={country.pattern.replace(/#/g, '0')} maxLength={country.pattern.length + 4}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="field__error">
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
