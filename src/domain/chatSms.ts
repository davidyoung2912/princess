/** Chat by text for guests ashore (docs/chat-plan.md, 4.9 and phase 6). Framework-free. */
import type { ChatSmsReason } from '../api/chatTypes'

const REASONS: readonly ChatSmsReason[] = ['supervised', 'noPhone', 'unverified', 'off']

/** The reason chat by text cannot be turned on, from an error's code or detail; null when it is not one of them. */
export function smsReason(...found: (string | null | undefined)[]): ChatSmsReason | null {
  for (const f of found) {
    const hit = REASONS.find((r) => r === f)
    if (hit) return hit
  }
  return null
}

/** Whether the guest needs to go and confirm a number before the switch can work (a missing or unconfirmed number). */
export const needsPhone = (reason: ChatSmsReason | null): boolean => reason === 'noPhone' || reason === 'unverified'

/** The names shown after "Ashore, replies by text": nothing when nobody is, and at most three then a count. */
export function ashoreNames(names: readonly string[] | undefined, max = 3): string {
  const list = (names ?? []).filter(Boolean)
  if (list.length <= max) return list.join(', ')
  return `${list.slice(0, max).join(', ')} +${list.length - max}`
}
