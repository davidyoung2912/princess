/** Reactions under a message (docs/chat-features-research.md, section 11, phase 1). Framework-free: the picker's six, optimistic toggling and the words a screen reader hears. */
import type { ChatReaction } from '../api/chatTypes'

/** The six reactions, in picker order. The server holds the same list and refuses any other. */
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const
export type Reaction = (typeof REACTIONS)[number]

export const isReaction = (v: unknown): v is Reaction => typeof v === 'string' && (REACTIONS as readonly string[]).includes(v)

/** The emoji you have chosen on a message, if any. */
export const myReaction = (reactions: readonly ChatReaction[] | undefined): string | null => reactions?.find((r) => r.mine)?.emoji ?? null

/**
 * What the chips become when you pick `emoji`, shown before the server answers: one reaction per person, so your old one is taken off, and picking the one you hold clears it.
 * The names of others are kept as they are; yours is never named.
 */
export function toggleReaction(reactions: readonly ChatReaction[] | undefined, emoji: string): ChatReaction[] {
  const held = myReaction(reactions)
  const without = (reactions ?? [])
    .map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : r))
    .filter((r) => r.count > 0)
  if (held === emoji) return sortChips(without)
  const at = without.findIndex((r) => r.emoji === emoji)
  if (at === -1) return sortChips([...without, { emoji, count: 1, mine: true, names: [] }])
  return sortChips(without.map((r, i) => (i === at ? { ...r, count: r.count + 1, mine: true } : r)))
}

const sortChips = (chips: ChatReaction[]): ChatReaction[] => [...chips].sort((a, b) => REACTIONS.indexOf(a.emoji as Reaction) - REACTIONS.indexOf(b.emoji as Reaction))

/** Who chose a reaction, as a list for a screen reader: the others by name and "You" when it is yours, in that order ("Sam R. and you"). */
export function whoReacted(r: ChatReaction, you: string): string {
  const names = r.mine ? [...r.names, you] : r.names
  // The server names only the others and the count includes everyone; if names are missing (not yet known), the count still tells the truth.
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The accessible name of a chip: "👍 2: Sam R. and you". A chip with no known names reads as just its count. */
export function chipLabel(r: ChatReaction, you: string): string {
  const who = whoReacted(r, you)
  return who ? `${r.emoji} ${r.count}: ${who}` : `${r.emoji} ${r.count}`
}

/** The message with these chips; none removes the field, so a message nobody reacted to looks as it did before. */
export function withReactions<T extends { reactions?: ChatReaction[] }>(m: T, chips: readonly ChatReaction[]): T {
  const { reactions: _old, ...rest } = m
  return (chips.length > 0 ? { ...rest, reactions: [...chips] } : rest) as T
}
