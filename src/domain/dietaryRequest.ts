import type { StringKey } from '../shared/i18n'
import type { BadgeKind } from '../shared/ui/StatusBadge'

/** What the request is about: a medical allergy, a diet, or anything else. */
export type DietaryKind = 'allergy' | 'diet' | 'other'
export const DIETARY_KINDS: readonly DietaryKind[] = ['allergy', 'diet', 'other']

/** Where a request stands. The dining operation moves it; an unreviewed request is never shown as approved (DIN-112). */
export type DietaryStatus = 'received' | 'review' | 'confirmed' | 'contact' | 'unable'

export const DIETARY_NOTE_MAX = 300

export interface DietaryRequest {
  /** The guest it is for. */
  guest: string
  kind: DietaryKind
  note: string
  status: DietaryStatus
  /** When it was sent (ms). */
  sentAt: number
}

export const DIETARY_STATUS_LABEL: Record<DietaryStatus, StringKey> = {
  received: 'diet.status.received', review: 'diet.status.review', confirmed: 'diet.status.confirmed', contact: 'diet.status.contact', unable: 'diet.status.unable',
}

/** What each status means for the guest, in a sentence. */
export const DIETARY_STATUS_HELP: Record<DietaryStatus, StringKey> = {
  received: 'diet.help.received', review: 'diet.help.review', confirmed: 'diet.help.confirmed', contact: 'diet.help.contact', unable: 'diet.help.unable',
}

export const DIETARY_BADGE: Record<DietaryStatus, BadgeKind> = {
  received: 'submitted', review: 'pending', confirmed: 'confirmed', contact: 'changed', unable: 'declined',
}

/** Only the dining operation's own word of confirmation counts as approved. */
export const isDietaryConfirmed = (r: Pick<DietaryRequest, 'status'>): boolean => r.status === 'confirmed'

/** Whether staff still have something to do or say: the guest should not treat the meal as sorted. */
export const needsAttention = (r: Pick<DietaryRequest, 'status'>): boolean => r.status === 'contact' || r.status === 'unable'

/** The request is ready to send: a kind, some words, and the allergy process acknowledged. */
export function canSendDietary(input: { kind: string; note: string; acknowledged: boolean }): boolean {
  return (DIETARY_KINDS as readonly string[]).includes(input.kind) && input.note.trim().length > 0 && input.acknowledged
}

/** Requests for the reservation that need a word with staff or cannot be met, for a heads-up on lists. */
export const requestsNeedingAttention = (requests: readonly DietaryRequest[]): DietaryRequest[] => requests.filter(needsAttention)
