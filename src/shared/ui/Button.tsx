import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { buttonIcon, labelText } from './buttonIcons'
import { titleNode } from './titleNode'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger'

interface Common {
  variant?: ButtonVariant
  /** Fill the width of the container; the main action on a phone. */
  block?: boolean
  children: ReactNode
  /** The icon to the left of the words; by default one chosen from the words (see buttonIcons). `false` for none. A button that holds an icon of its own gets no extra one. */
  icon?: LucideIcon | false
}

type ButtonProps = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>
type LinkButtonProps = Common & Omit<LinkProps, 'children'>

/** The icon to put before a button's words, or null for none. */
function iconFor(icon: LucideIcon | false | undefined, children: ReactNode, link: boolean): LucideIcon | null {
  if (icon === false) return null
  if (icon) return icon
  const text = labelText(children)
  return text ? buttonIcon(text, link) : null
}

function ButtonIcon({ icon: Icon }: { icon: LucideIcon | null }) {
  return Icon ? <Icon aria-hidden="true" focusable="false" className="btn__icon" /> : null
}

const classes = (variant: ButtonVariant, block: boolean | undefined, extra?: string) =>
  ['btn', `btn--${variant}`, block ? 'btn--block' : '', extra ?? ''].filter(Boolean).join(' ')

/** A rounded action. Never leave one disabled without saying why next to it. */
export function Button({ variant = 'primary', block, className, type = 'button', children, icon, ...rest }: ButtonProps) {
  const chosen = iconFor(icon, children, false)
  return (
    <button type={type} className={classes(variant, block, className)} {...rest}>
      <ButtonIcon icon={chosen} />
      {titleNode(children)}
    </button>
  )
}

/** A link that looks like a button, for moving to another screen. */
export function LinkButton({ variant = 'primary', block, className, children, icon, ...rest }: LinkButtonProps) {
  const chosen = iconFor(icon, children, true)
  return (
    <Link className={classes(variant, block, className)} {...rest}>
      <ButtonIcon icon={chosen} />
      {titleNode(children)}
    </Link>
  )
}
