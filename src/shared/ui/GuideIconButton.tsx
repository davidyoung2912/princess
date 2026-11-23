import type { ButtonHTMLAttributes, ComponentType } from 'react'

type IconType = ComponentType<{ 'aria-hidden'?: boolean | 'true' | 'false'; className?: string }>

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> {
  icon: IconType
  /** What the button does, in words: its accessible name and the tip shown on hover and focus. */
  label: string
  /** A longer accessible name when the label alone does not say which task it is for (the tip still shows `label`). */
  describedAs?: string
}

/**
 * A quiet round icon button for the small actions under a main button (put off, not for me, help, remind me, add to calendar). The words live in the
 * accessible name and in a tip that shows on hover and keyboard focus; on hover and focus the button lifts and glows.
 */
export function GuideIconButton({ icon: Icon, label, describedAs, className, type = 'button', ...rest }: Props) {
  return (
    <button type={type} className={`guide-icon${className ? ` ${className}` : ''}`} aria-label={describedAs ?? label} data-tip={label} {...rest}>
      <Icon aria-hidden="true" />
    </button>
  )
}
