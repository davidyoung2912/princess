import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger'

interface Common {
  variant?: ButtonVariant
  /** Fill the width of the container; the main action on a phone. */
  block?: boolean
  children: ReactNode
}

type ButtonProps = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>
type LinkButtonProps = Common & Omit<LinkProps, 'children'>

const classes = (variant: ButtonVariant, block: boolean | undefined, extra?: string) =>
  ['btn', `btn--${variant}`, block ? 'btn--block' : '', extra ?? ''].filter(Boolean).join(' ')

/** A pill-shaped action. Never leave one disabled without saying why next to it. */
export function Button({ variant = 'primary', block, className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={classes(variant, block, className)} {...rest}>
      {children}
    </button>
  )
}

/** A link that looks like a button, for moving to another screen. */
export function LinkButton({ variant = 'primary', block, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={classes(variant, block, className)} {...rest}>
      {children}
    </Link>
  )
}
