import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { CircleAlert } from './icons'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: string
  /** An error message; shows with an icon and is announced with the field. */
  error?: string
}

/** A text field with a visible label above it, optional hint, and an inline error. Never uses the placeholder as the label. */
export function Field({ label, hint, error, ...rest }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && <p id={hintId} className="field__hint">{hint}</p>}
      <input id={id} className="field__input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      {error && (
        <p id={errorId} className="field__error">
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

interface ErrorSummaryProps {
  title: string
  errors: readonly string[]
}

/** The list of problems at the top of a form after a failed submit; announced as an alert. */
export function ErrorSummary({ title, errors }: ErrorSummaryProps) {
  if (errors.length === 0) return null
  return (
    <div className="error-summary" role="alert">
      <h2>{title}</h2>
      <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  )
}

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  hint?: string
}

/** A multi-line field with a visible label and optional hint. */
export function TextArea({ label, hint, ...rest }: TextAreaProps) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && <p id={`${id}-hint`} className="field__hint">{hint}</p>}
      <textarea id={id} className="field__input" rows={3} aria-describedby={hint ? `${id}-hint` : undefined} {...rest} />
    </div>
  )
}
