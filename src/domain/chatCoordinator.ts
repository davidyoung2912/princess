/** The group coordinator (docs/chat-features-research.md, phase 11). Framework-free; the server decides everything, this only picks the words for what it said. */
import type { ChatCoordinatorPreview, ChatMessage, ChatRemaining, GroupStanley } from '../api/chatTypes'

/** Whether the organiser's Stanley buttons are offered: the caller is an admin and the group has let Stanley help. The server checks again on every tap. */
export const mayCoordinate = (state: Pick<GroupStanley, 'on' | 'canChange'> | null | undefined): boolean => state?.on === true && state.canChange === true

/** Only a poll or a plan can be tallied or reminded about. */
export const isCoordinable = (m: Pick<ChatMessage, 'kind' | 'deleted'>): boolean => m.deleted !== true && (m.kind === 'poll' || m.kind === 'plan')

export type CoordinatorProblem = 'notAdmin' | 'off' | 'child' | 'notGroup' | 'closed' | 'tooSoon' | 'busy' | 'notPoll' | 'offline' | 'other'

/** The kind of failure from an API error's `message` and code, so a screen picks one sentence. */
export function coordinatorProblem(code: string, message: string | undefined): CoordinatorProblem {
  if (code === 'offline' || code === 'network' || code === 'timeout') return 'offline'
  switch (message) {
    case 'notAdmin': case 'off': case 'child': case 'notGroup': case 'closed': case 'tooSoon': case 'busy': case 'notPoll': return message
    default: return 'other'
  }
}

/** Why a reminder cannot go now, as a key suffix, or null when it can. */
export const reminderReason = (p: Pick<ChatCoordinatorPreview, 'canRemind' | 'reason'>): 'closed' | 'tooSoon' | 'none' | null => (p.canRemind ? null : (p.reason ?? 'none'))

/** One line for a screen reader about one item the organiser is waiting on: counts, never names. */
export const remainingLine = (item: ChatRemaining['items'][number]): string => `${item.title}: ${item.answered} of ${item.total} answered`
