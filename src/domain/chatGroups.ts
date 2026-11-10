/** Rules for the chat group screens (docs/chat-plan.md, phase 5). Framework-free. */
import type { ChatConnection, ChatGroup, ChatGroupInvite } from '../api/chatTypes'

/** The most people in a group, the creator included. The server enforces it; the screen uses it to say how many places are left. */
export const MAX_GROUP = 25
export const MAX_GROUP_NAME = 40
/** A group is three or more people: the creator and at least two invited. */
export const MIN_INVITED = 2

/** The name with spaces tidied, or null when it is empty or too long. */
export function cleanGroupName(text: string): string | null {
  const name = text.trim().replace(/\s+/g, ' ')
  return name.length > 0 && name.length <= MAX_GROUP_NAME ? name : null
}

/** Whether a new group can be made: a good name and at least two people picked. */
export function canCreateGroup(name: string, picked: number): boolean {
  return cleanGroupName(name) !== null && picked >= MIN_INVITED && picked + 1 <= MAX_GROUP
}

/** Places left in a group: the limit less the people in it and the invitations still waiting. Never below zero. */
export function placesLeft(group: Pick<ChatGroup, 'members' | 'waiting' | 'max'>): number {
  return Math.max(0, group.max - group.members.length - group.waiting.length)
}

/** People the guest could add: their connections who are not in the group and have no invitation waiting. */
export function invitable(connected: readonly ChatConnection[], group: Pick<ChatGroup, 'members' | 'waiting'> | null): ChatConnection[] {
  const taken = new Set([...(group?.members ?? []).map((m) => m.id), ...(group?.waiting ?? []).map((w) => w.personId)])
  return connected.filter((c) => !taken.has(c.personId))
}

/** Flips one person in or out of the picked list, keeping the order they were picked in. */
export function togglePicked(picked: readonly string[], id: string): string[] {
  return picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id]
}

/** Invitations for the guest themself, apart from those for a child (those count as approvals). */
export function ownInvites(invites: readonly ChatGroupInvite[]): ChatGroupInvite[] {
  return invites.filter((i) => i.kind === 'incoming')
}

export type GroupProblem = 'name' | 'blocked' | 'tooFew' | 'tooMany' | 'notConnected' | 'noGuardian' | 'supervised' | 'creator' | 'full' | 'answered' | 'expired' | 'other'

const PROBLEMS: readonly GroupProblem[] = ['name', 'blocked', 'tooFew', 'tooMany', 'notConnected', 'noGuardian', 'supervised', 'creator', 'full', 'answered', 'expired']

/** The server's code and title, mapped to the wording that says what to do next. */
export function groupProblem(code: string | undefined, detail: string | undefined): GroupProblem {
  return PROBLEMS.find((p) => p === detail) ?? PROBLEMS.find((p) => p === code) ?? 'other'
}
