import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { t } from '../i18n'
import { CODE_LENGTH, digitsOnly } from './codeDigits'

interface CodeBoxesProps {
  label: string
  hint?: string
  /** The digits typed so far, up to six. */
  value: string
  onChange: (digits: string) => void
  error?: string
}

/**
 * A six-digit code as six boxes that take digits only. Typing a digit moves on to the next box; Backspace clears and goes back; the arrow keys move between boxes; a whole code
 * pasted into any box (or filled in by the phone from a message) fills them all. The boxes are one group with one label, and each says which digit it is.
 */
export function CodeBoxes({ label, hint, value, onChange, error }: CodeBoxesProps) {
  const id = useId()
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = digitsOnly(value)
  const focusAt = (i: number) => refs.current[Math.min(Math.max(i, 0), CODE_LENGTH - 1)]?.focus()
  const set = (i: number, d: string) => onChange((digits.slice(0, i).padEnd(i, ' ') + d + digits.slice(i + 1)).replace(/ /g, '').slice(0, CODE_LENGTH))

  const type = (i: number, text: string) => {
    const typed = digitsOnly(text)
    if (typed === '') return
    if (typed.length > 1) { // a pasted or auto-filled code: fill from this box on
      const next = digitsOnly(digits.slice(0, i) + typed)
      onChange(next)
      focusAt(next.length >= CODE_LENGTH ? CODE_LENGTH - 1 : next.length)
      return
    }
    set(i, typed)
    focusAt(i + 1)
  }
  const key = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) onChange(digits.slice(0, i) + digits.slice(i + 1))
      else { onChange(digits.slice(0, Math.max(i - 1, 0)) + digits.slice(i)); focusAt(i - 1) }
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); focusAt(i - 1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); focusAt(i + 1) }
  }
  const paste = (i: number, e: ClipboardEvent<HTMLInputElement>) => { e.preventDefault(); type(i, e.clipboardData.getData('text')) }

  return (
    <div className="field code-boxes" role="group" aria-labelledby={`${id}-label`} aria-describedby={[hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}>
      <div className="field__top"><span id={`${id}-label`} className="code-boxes__label">{label}</span></div>
      <div className="code-boxes__row">
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el }}
            className="field__input code-boxes__box"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={t('code.digit', { n: i + 1, total: CODE_LENGTH })}
            aria-invalid={error ? true : undefined}
            value={digits[i] ?? ''}
            maxLength={CODE_LENGTH}
            onChange={(e) => type(i, e.target.value)}
            onKeyDown={(e) => key(i, e)}
            onPaste={(e) => paste(i, e)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
      {hint && <p id={`${id}-hint`} className="field__hint">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="field__error">{error}</p>}
    </div>
  )
}
