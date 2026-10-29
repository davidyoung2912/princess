import type { ReactNode } from 'react'
import { CircleCheck, Info, OctagonAlert, TriangleAlert, WifiOff } from './icons'

export type BannerKind = 'info' | 'success' | 'warning' | 'danger' | 'offline'

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: OctagonAlert, offline: WifiOff } as const

interface BannerProps {
  kind: BannerKind
  title: string
  children?: ReactNode
  /** An action, e.g. a Button. */
  action?: ReactNode
}

/** A message with an icon, a title and an optional action. Danger is announced at once; the rest politely. Colour is never the only signal. */
export function Banner({ kind, title, children, action }: BannerProps) {
  const Icon = ICONS[kind]
  return (
    <div className={`banner banner--${kind}`} role={kind === 'danger' ? 'alert' : 'status'}>
      <Icon className="banner__icon" aria-hidden="true" />
      <div className="banner__text">
        <p className="banner__title">{title}</p>
        {children && <div>{children}</div>}
      </div>
      {action && <div className="banner__action">{action}</div>}
    </div>
  )
}
