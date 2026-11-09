/**
 * One vocabulary for where a request, booking or payment stands (TRU-03). Nine states, each with a word, a plain-language meaning
 * and whether it is still moving. The badge shows the word and an icon, never colour alone. Framework-free.
 */
export const LIFECYCLE = ['draft', 'submitted', 'pending', 'confirmed', 'declined', 'cancelled', 'refunded', 'expired', 'failed'] as const
export type Lifecycle = (typeof LIFECYCLE)[number]

export const isLifecycle = (v: unknown): v is Lifecycle => typeof v === 'string' && (LIFECYCLE as readonly string[]).includes(v)

/** A state that can still change: nothing more is expected once it is false. */
export const isOpen = (s: Lifecycle): boolean => s === 'draft' || s === 'submitted' || s === 'pending'

/** A state the guest may need to act on (try again, ask someone, start over). */
export const needsAction = (s: Lifecycle): boolean => s === 'declined' || s === 'expired' || s === 'failed'

/** Whether a move from one state to another makes sense; a screen should not show a confirmed item going back to draft. */
const NEXT: Record<Lifecycle, readonly Lifecycle[]> = {
  draft: ['submitted', 'cancelled', 'expired'],
  submitted: ['pending', 'confirmed', 'declined', 'cancelled', 'failed', 'expired'],
  pending: ['confirmed', 'declined', 'cancelled', 'failed', 'expired'],
  confirmed: ['cancelled', 'refunded', 'expired'],
  declined: [],
  cancelled: ['refunded'],
  refunded: [],
  expired: [],
  failed: ['submitted'],
}
export const canMove = (from: Lifecycle, to: Lifecycle): boolean => NEXT[from].includes(to)

/** Words the server or an older screen may use, mapped to the nine. Anything else is unknown and returns null: never guessed. */
const ALIASES: Record<string, Lifecycle> = {
  saved: 'draft', sent: 'submitted', waiting: 'pending', queued: 'pending', requested: 'submitted', approved: 'confirmed', booked: 'confirmed',
  accepted: 'confirmed', done: 'confirmed', rejected: 'declined', denied: 'declined', canceled: 'cancelled', voided: 'cancelled', lapsed: 'expired',
  timedOut: 'expired', error: 'failed', paid: 'confirmed', returned: 'refunded',
}
export function lifecycleOf(word: unknown): Lifecycle | null {
  if (isLifecycle(word)) return word
  return typeof word === 'string' ? (ALIASES[word] ?? null) : null
}
