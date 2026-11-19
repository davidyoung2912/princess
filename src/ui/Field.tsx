import { useId, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ClearDraft } from './ClearDraft'
import { CircleAlert, Eye, EyeOff } from './icons'
import { t } from '../i18n'
import { headingCase } from '../i18n'
import { HelpTip } from './HelpTip'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: string
  /** An optional short explanation of what the field is for, opened from a "?" button beside the label. */
  help?: string
  /** An error message; shows with an icon and is announced with the field. */
  error?: string
  /** The guest is writing in their own words (a note, a question), not entering a name, code or number: turns on spell checking, autocorrect and a capital at the start of a sentence. */
  prose?: boolean
  /** For a password: a button inside the box shows the characters while it is on. Off to start with. */
  reveal?: boolean
}

/** A text field with a visible label above it, optional hint, and an inline error. Never uses the placeholder as the label. */
export function Field({ label, hint, help, error, prose, reveal, ...rest }: FieldProps) {
  const id = useId()
  const [shown, setShown] = useState(false)
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
      {reveal ? (
        <div className="field__control">
          <input id={id} className="field__input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...(prose ? { spellCheck: true, autoCorrect: 'on', autoCapitalize: 'sentences' } : {})} {...rest} {...(reveal ? { type: shown ? 'text' : 'password', autoCapitalize: 'none', spellCheck: false } : {})} />
          <button type="button" className="field__reveal" aria-pressed={shown} aria-label={t(shown ? 'field.hidePassword' : 'field.showPassword')} title={t(shown ? 'field.hidePassword' : 'field.showPassword')} onClick={() => setShown((v) => !v)}>
            {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
      ) : (
        <input id={id} className="field__input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...(prose ? { spellCheck: true, autoCorrect: 'on', autoCapitalize: 'sentences' } : {})} {...rest} {...(reveal ? { type: shown ? 'text' : 'password', autoCapitalize: 'none', spellCheck: false } : {})} />
      )}
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
  /** Show a Clear button under the box while it holds something (default on). A screen that has a Clear of its own for the whole draft turns this off. */
  clear?: boolean
}

/** Empties a controlled textarea the way typing would, so the screen's own `onChange` runs. */
function emptyTextarea(box: HTMLTextAreaElement) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(box, '')
  box.dispatchEvent(new Event('input', { bubbles: true }))
  box.focus()
}

/** A multi-line field with a visible label and optional hint. It holds the guest's own words, so spell checking, autocorrect and sentence capitals are on (a caller can override). */
export function TextArea({ label, hint, help, clear = true, ...rest }: TextAreaProps) {
  const id = useId()
  const box = useRef<HTMLTextAreaElement>(null)
  const filled = typeof rest.value === 'string' && rest.value !== '' && !rest.readOnly && !rest.disabled
  return (
    <div className="field">
      <div className="field__top">
        <label htmlFor={id}>{label}</label>
        {help && <HelpTip about={label}>{help}</HelpTip>}
      </div>
      {hint && <p id={`${id}-hint`} className="field__hint">{hint}</p>}
      <textarea ref={box} id={id} className="field__input" rows={3} aria-describedby={hint ? `${id}-hint` : undefined} spellCheck autoCorrect="on" autoCapitalize="sentences" {...rest} />
      {clear && <ClearDraft show={filled} onClear={() => box.current && emptyTextarea(box.current)} />}
    </div>
  )
}
