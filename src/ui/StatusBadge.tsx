import { Ban, Check, Clock, Info, TriangleAlert } from './icons'

export type BadgeKind = 'booked' | 'waitlist' | 'soldOut' | 'changed' | 'cancelled' | 'ready'

const ICONS = { booked: Check, waitlist: Clock, soldOut: Ban, changed: TriangleAlert, cancelled: Ban, ready: Info } as const

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
