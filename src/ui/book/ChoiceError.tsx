import { CircleAlert } from '../icons'

/** The problem with a group of choices (radios), shown under the group with an icon so it never relies on colour. */
export function ChoiceError({ text }: { text: string | undefined }) {
  if (!text) return null
  return (
    <p className="field__error">
      <CircleAlert aria-hidden="true" />
      <span>{text}</span>
    </p>
  )
}
