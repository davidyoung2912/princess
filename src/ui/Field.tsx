import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { CircleAlert } from './icons'
import { headingCase } from '../i18n'
import { HelpTip } from './HelpTip'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: string
  /** An optional short explanation of what the field is for, opened from a "?" button beside the label. */
  help?: string
  /** An error message; shows with an icon and is announced with the field. */
  error?: string
}

/** A text field with a visible label above it, optional hint, and an inline error. Never uses the placeholder as the label. */
export function Field({ label, hint, help, error, ...rest }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <div className="field__top">
        <label htmlFor={id}>{label}</label>
        {help && <HelpTip about={label}>{help}</HelpTip>}
      </div>
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

interface FieldLabelProps {
  htmlFor: string
  /** An optional short explanation, opened from a "?" button beside the label. */
  help?: string
  children: string
}

/** The label of a control that is not a text field (a select, say), with the same optional "?" button as `Field`. */
export function FieldLabel({ htmlFor, help, children }: FieldLabelProps) {
  return (
    <div className="field__top">
      <label htmlFor={htmlFor}>{children}</label>
      {help && <HelpTip about={children}>{help}</HelpTip>}
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
      <h2>{headingCase(title)}</h2>
      <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  )
}

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  hint?: string
  /** An optional short explanation, opened from a "?" button beside the label. */
  help?: string
}

/** A multi-line field with a visible label and optional hint. */
export function TextArea({ label, hint, help, ...rest }: TextAreaProps) {
  const id = useId()
  return (
    <div className="field">
      <div className="field__top">
        <label htmlFor={id}>{label}</label>
        {help && <HelpTip about={label}>{help}</HelpTip>}
      </div>
      {hint && <p id={`${id}-hint`} className="field__hint">{hint}</p>}
      <textarea id={id} className="field__input" rows={3} aria-describedby={hint ? `${id}-hint` : undefined} {...rest} />
    </div>
  )
}
