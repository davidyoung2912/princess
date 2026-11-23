import { createFeed, isRecord, oneOf } from './feed'

export type FriendReply = 'accepted' | 'declined'

/** Reads the server's answer to a sail-again invitation. */
export function normalizeFriendReply(raw: unknown): FriendReply | null {
  return isRecord(raw) && oneOf(raw.reply, ['accepted', 'declined'] as const) ? raw.reply : null
}

/**
 * How a friend answers, by the name the guest typed. Asked only after the guest has agreed to invite that contact, and never kept on the device
 * (the contact's name is already in the guest's own synced notes).
 */
export const friendReplyFeed = createFeed<[name: string], FriendReply>((n) => n.toLowerCase(), normalizeFriendReply)
