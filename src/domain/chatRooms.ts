/** Rules for the channel and room screens (docs/chat-features-research.md, phase 8). Framework-free. */
import type { ChatConversation, ChatRoomListItem } from '../api/chatTypes'

export const MIN_QUESTION = 5
export const MAX_QUESTION = 200

/** A channel or a room, for the screens that behave differently (posts, controls). */
export const isRoomChat = (c: Pick<ChatConversation, 'kind'> | null | undefined): boolean => c?.kind === 'channel' || c?.kind === 'room'

/** The question with spaces tidied, or null when it is too short or too long. */
export function cleanQuestion(text: string): string | null {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length >= MIN_QUESTION && t.length <= MAX_QUESTION ? t : null
}

export type RoomProblem = 'child' | 'noBooking' | 'removed' | 'off' | 'closed' | 'full' | 'text' | 'contactInfo' | 'blocked' | 'tooMany' | 'other'
const PROBLEMS: readonly RoomProblem[] = ['child', 'noBooking', 'removed', 'off', 'closed', 'full', 'text', 'contactInfo', 'blocked', 'tooMany']

/** The server's code and title for a failed join or suggestion, mapped to the wording that says what to do next. */
export function roomProblem(code: string | undefined, detail: string | undefined): RoomProblem {
  return PROBLEMS.find((p) => p === detail) ?? PROBLEMS.find((p) => p === code) ?? 'other'
}

/** A room's post box: whether it shows, and if not the reason. A first post asks for the rules, so that is not a reason to hide it. */
export function roomPostState(c: Pick<ChatConversation, 'kind' | 'room' | 'closed'>): 'open' | 'staffOnly' | 'muted' | 'closed' | 'off' {
  if (!c.room) return c.closed ? 'closed' : 'open'
  if (c.room.canPost && !c.closed) return 'open'
  switch (c.room.why) {
    case 'staffOnly': return 'staffOnly'
    case 'muted': return 'muted'
    case 'off': return 'off'
    default: return 'closed'
  }
}

/** Whether this post needs the guest to say yes to the rules first. */
export const needsRules = (c: Pick<ChatConversation, 'room'>): boolean => c.room !== undefined && !c.room.rulesAccepted

export interface RoomGroups { channels: ChatRoomListItem[]; sailing: ChatRoomListItem[]; interest: ChatRoomListItem[] }

const byName = (a: ChatRoomListItem, b: ChatRoomListItem) => a.name.localeCompare(b.name)

/** The directory in three parts: channels, rooms for a sailing and rooms for an interest. Ones the guest is in come first, then by name. */
export function groupRooms(list: readonly ChatRoomListItem[]): RoomGroups {
  const order = (items: ChatRoomListItem[]) => [...items.filter((r) => r.joined).sort(byName), ...items.filter((r) => !r.joined).sort(byName)]
  return {
    channels: order(list.filter((r) => r.kind === 'channel')),
    sailing: order(list.filter((r) => r.kind === 'room' && r.roomKind === 'sailing')),
    interest: order(list.filter((r) => r.kind === 'room' && r.roomKind !== 'sailing')),
  }
}

/** Whether the guest can join or follow it now. */
export const canJoinRoom = (r: Pick<ChatRoomListItem, 'joined' | 'blocked'>): boolean => !r.joined && !r.blocked
