import { Ban, Check, CircleAlert, Clock, Info, TriangleAlert } from './icons'
import { t } from '../i18n'
import type { Lifecycle } from '../domain/lifecycle'

export type BadgeKind = 'booked' | 'waitlist' | 'soldOut' | 'changed' | 'cancelled' | 'ready' | Lifecycle

const ICONS = {
  booked: Check, waitlist: Clock, soldOut: Ban, changed: TriangleAlert, cancelled: Ban, ready: Info,
  draft: Info, submitted: Clock, pending: Clock, confirmed: Check, declined: Ban, refunded: Info, expired: Clock, failed: CircleAlert,
} as const

/** A status as word + icon + colour, so it reads without colour. */
export function StatusBadge({ kind, label }: { kind: BadgeKind; label: string }) {
  const Icon = ICONS[kind]
  return (
    <span className={`badge badge--${kind}`}>
      <Icon aria-hidden="true" />
      {label}
    </span>
  )
}

/** One of the nine lifecycle states (TRU-03), worded the same everywhere. */
export function LifecycleBadge({ state }: { state: Lifecycle }) {
  return <StatusBadge kind={state} label={t(`lifecycle.${state}`)} />
}
