import type { ChatEligibility, ChatKeep, ChatKeepReason } from '../api/chatTypes'

/** A day the server sends as epoch milliseconds at UTC midnight, as words: "March 20, 2028". The day itself, whatever zone the phone is in. */
export function keepDate(ms: number): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms))
}

/** What the keep section says about a conversation, as a stable code the screen turns into words. */
export type KeepStatus =
  | 'unavailable'   // the chat cannot be kept (see `reason`)
  | 'kept'          // every person agreed: held until `deleteOn`
  | 'waiting'       // the viewer agreed and others have not
  | 'offer'         // the viewer has not agreed
  | 'guardian'      // the viewer is a supervised child: their guardian decides

export function keepStatus(k: ChatKeep): KeepStatus {
  if (!k.available) return 'unavailable'
  if (k.kept) return 'kept'
  if (k.needsGuardian) return 'guardian'
  return k.mine ? 'waiting' : 'offer'
}

/** The day the messages go: the kept day when kept, else the standard one. Null when the server gave none. */
export function deleteDay(k: ChatKeep): number | null {
  return k.kept ? k.deleteOn : k.standardDeleteOn
}

/** Whether the keep button should read "Stop keeping" (the viewer has agreed) rather than "Keep this chat". */
export const hasAgreed = (k: ChatKeep): boolean => k.mine

/** Conversations the list should tag as kept, by id. */
export function keptIds(keeps: readonly ChatKeep[]): Set<string> {
  return new Set(keeps.filter((k) => k.available && k.kept).map((k) => k.id))
}

/** For the privacy centre: how many chats are kept and the last day any of them is held to, or null when none is kept. */
export function keptSummary(keeps: readonly ChatKeep[]): { count: number; until: number } | null {
  const kept = keeps.filter((k) => k.available && k.kept && k.deleteOn !== null)
  if (kept.length === 0) return null
  return { count: kept.length, until: Math.max(...kept.map((k) => k.deleteOn as number)) }
}

/** The tag a kept conversation wears in the list, or null: "Kept until March 20, 2028". */
export function keptUntil(keeps: readonly ChatKeep[], id: string): number | null {
  const k = keeps.find((x) => x.id === id)
  return k && k.available && k.kept ? k.deleteOn : null
}

/** Whether to offer Chat's people (finding a guest, making a group) at all. Chat is never hidden, only the people part before a booking. */
export const canFindPeople = (e: ChatEligibility | null | undefined): boolean => e?.people !== false

/** Whether to offer Guest Services: from a confirmed booking, before boarding as well as aboard. Unknown (still loading, or offline) counts as available; the server decides. */
export const canUseGuestServices = (e: ChatEligibility | null | undefined): boolean => e?.guestServices !== false

/** The words key for why a chat cannot be kept. */
export const KEEP_REASON_KEY: Record<ChatKeepReason, string> = {
  permanent: 'keep.reason.permanent',
  closed: 'keep.reason.closed',
  noTrip: 'keep.reason.noTrip',
  tooLate: 'keep.reason.tooLate',
}

/** Names of the people who have not agreed, as one phrase: "Sam R.", "Sam R. and Alex T.", "Sam R., Alex T. and 2 others". */
export function waitingPhrase(names: readonly string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  const rest = names.length - 2
  return `${names[0]}, ${names[1]} and ${rest} ${rest === 1 ? 'other' : 'others'}`
}
