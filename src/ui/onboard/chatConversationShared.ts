import type { ChangeProblem, MuteLength } from '../../domain/chatControl'
import type { StringKey } from '../../i18n'

/** Conversations this device has already said it received messages for (by id and last message time), so a refresh of the list does not ask again. */
export const deliveredSeen = new Set<string>()


/** After a card grows (a delete or edit panel, the reaction picker, an error), bring the whole card into view in the history; nothing moves if it already fits. */
export const keepCardInView = (from: Element | null | undefined): number | undefined => {
  const card = from?.closest('.chat-msg')
  if (!card) return undefined
  return window.requestAnimationFrame(() => card.scrollIntoView({ block: 'nearest', behavior: 'auto' }))
}

export const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches


export const LANE_KEY = { critical: 'stanley.notice.lane.critical', important: 'stanley.notice.lane.important', reminder: 'stanley.notice.lane.reminder', info: 'stanley.notice.lane.info', suggestion: 'stanley.notice.lane.suggestion' } as const


export const noop = (): void => {}


export const PROBLEM_KEY: Record<ChangeProblem, StringKey> = {
  tooLate: 'conv.tooLate', blocked: 'conv.editBlocked', contact: 'conv.editContact', text: 'conv.editFailed', deleted: 'conv.deleted', other: 'conv.editFailed',
}


export const MUTE_KEY: Record<MuteLength, StringKey> = { hour: 'conv.muteHour', day: 'conv.muteDay', week: 'conv.muteWeek', forever: 'conv.muteForever' }

