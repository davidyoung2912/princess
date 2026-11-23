/** Chat bundles, phase B6: a day board. A group builds one day together; each member says "I'm in" for any item. Framework-free. */
import type { ChatBundle, ChatTally } from '../../../shared/api/chatTypes'
import { decisionActions } from './chatPlanning'

export const BOARD_MAX_ITEMS = 8

/** Whether you are in for item `i`: bit `i` of your answer (`tally.mine`). */
export const boardIn = (tally: Pick<ChatTally, 'mine'> | undefined, i: number): boolean => i >= 0 && i < BOARD_MAX_ITEMS && ((tally?.mine ?? 0) & (1 << i)) !== 0

/** The tally with your "I'm in" for item `i` set or cleared at once, before the server answers. */
export function applyBoardToggle(tally: ChatTally, i: number, on: boolean): ChatTally {
  if (i < 0 || i >= BOARD_MAX_ITEMS || boardIn(tally, i) === on) return tally
  const counts = [...tally.counts]
  if (counts[i] !== undefined) counts[i] = Math.max(0, counts[i]! + (on ? 1 : -1))
  const mine = on ? (tally.mine ?? 0) | (1 << i) : (tally.mine ?? 0) & ~(1 << i)
  return { ...tally, counts, mine }
}

/** What a board draft sends: the day and its things, or null when there is no day or nothing picked, or too many. Repeats are dropped. */
export function cleanBoardDraft(day: number, refs: readonly string[]): { day: number; refs: string[] } | null {
  const kept = [...new Set(refs.filter((r) => r.trim() !== ''))]
  return Number.isInteger(day) && day > 0 && kept.length > 0 && kept.length <= BOARD_MAX_ITEMS ? { day, refs: kept } : null
}

export interface BoardAdd { index: number; eventId: string; day: number }

/**
 * The items that can go on your own programme (a tour or a dinner is booked on its own screen, never added from chat, and an item gone for you has nothing to add).
 * `onlyIn` keeps just the ones you are in for.
 */
export function boardAdds(items: readonly (ChatBundle | null)[], tally: Pick<ChatTally, 'mine'> | undefined, onlyIn: boolean): BoardAdd[] {
  const out: BoardAdd[] = []
  items.forEach((b, index) => {
    const plan = decisionActions(b).plan
    if (plan && (!onlyIn || boardIn(tally, index))) out.push({ index, ...plan })
  })
  return out
}

/** The sentence a screen reader gets for one item: how many are in, and whether you are. */
export const boardItemWords = (count: number, mine: boolean, words: { count: (n: number) => string; yours: string }): string => [words.count(count), mine ? words.yours : ''].filter(Boolean).join(', ')
