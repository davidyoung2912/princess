import { Children, type ReactNode } from 'react'
import { headingCase } from '../i18n'

/** Button labels in Title Case (English only): text children are converted, icons and other elements pass through. */
export function titleNode(node: ReactNode): ReactNode {
  return Children.map(node, (child) => (typeof child === 'string' ? headingCase(child) : child))
}
