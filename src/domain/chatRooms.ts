/** Rules for the channel and room screens (docs/chat-features-research.md, phase 8). Framework-free. */
import type { ChatConversation, ChatRoomAdminItem, ChatRoomCreate, ChatRoomListItem } from '../api/chatTypes'

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

// ---- Staff screens (phase 8c) ----

export type StaffProblem = 'rota' | 'name' | 'topic' | 'sailing' | 'rules' | 'cap' | 'decided' | 'pinsFull' | 'other'
const STAFF_PROBLEMS: readonly StaffProblem[] = ['rota', 'name', 'topic', 'sailing', 'rules', 'cap', 'decided', 'pinsFull']

/** The server's code and title for a failed staff change, mapped to the wording that says what to do next. */
export function staffProblem(code: string | undefined, detail: string | undefined): StaffProblem {
  return STAFF_PROBLEMS.find((p) => p === detail) ?? STAFF_PROBLEMS.find((p) => p === code) ?? 'other'
}

/** What staff must still do before a closed room can open: name two moderators. */
export const MIN_MODERATORS = 2
export const canOpenRoom = (r: Pick<ChatRoomAdminItem, 'kind' | 'closed' | 'moderators'>): boolean => r.kind === 'room' && r.closed && r.moderators >= MIN_MODERATORS

/** Rooms open without their rota come first, then closed ones, then by name, so the gaps are seen at once. */
export function staffOrder(list: readonly ChatRoomAdminItem[]): ChatRoomAdminItem[] {
  const rank = (r: ChatRoomAdminItem) => (r.kind === 'room' && !r.closed && r.moderators < MIN_MODERATORS ? 0 : r.closed ? 2 : 1)
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

/** A new room's fields, tidied, or the first field that is wrong. A sailing room needs a sailing; an interest room needs a topic. */
export function checkNewRoom(f: { kind: 'channel' | 'room'; roomKind: 'sailing' | 'interest'; name: string; topic: string; sailingId: string }): { ok: true; body: ChatRoomCreate } | { ok: false; field: 'name' | 'topic' | 'sailing' } {
  const name = f.name.trim().replace(/\s+/g, ' ')
  if (name.length < 3 || name.length > 60) return { ok: false, field: 'name' }
  const topic = f.topic.trim().replace(/\s+/g, ' ')
  if (f.kind === 'channel') return { ok: true, body: { kind: 'channel', name, ...(topic ? { topic } : {}) } }
  if (f.roomKind === 'interest') return topic ? { ok: true, body: { kind: 'room', roomKind: 'interest', name, topic } } : { ok: false, field: 'topic' }
  const sailingId = f.sailingId.trim()
  return sailingId ? { ok: true, body: { kind: 'room', roomKind: 'sailing', name, sailingId } } : { ok: false, field: 'sailing' }
}
