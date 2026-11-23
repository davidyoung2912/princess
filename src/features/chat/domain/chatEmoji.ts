/** The desktop emoji picker (phase 9c): one small row of common emoji, then the system picker for the rest. No emoji dataset is bundled. */

/** `id` gives the spoken name (`emoji.<id>` in `en.ts`), so a screen reader hears "Party" and not a Unicode description. */
export const COMMON_EMOJI = [
  { id: 'grin', char: '😀' }, { id: 'laugh', char: '😂' }, { id: 'smile', char: '🙂' }, { id: 'love', char: '😍' },
  { id: 'cry', char: '😢' }, { id: 'wow', char: '😮' }, { id: 'sleepy', char: '😴' }, { id: 'think', char: '🤔' },
  { id: 'thumbs', char: '👍' }, { id: 'clap', char: '👏' }, { id: 'thanks', char: '🙏' }, { id: 'party', char: '🎉' },
  { id: 'heart', char: '❤️' }, { id: 'fire', char: '🔥' }, { id: 'check', char: '✅' }, { id: 'wave', char: '🌊' },
  { id: 'anchor', char: '⚓' }, { id: 'ship', char: '🚢' }, { id: 'sun', char: '☀️' }, { id: 'sunset', char: '🌅' },
  { id: 'drink', char: '🍹' }, { id: 'dinner', char: '🍽️' }, { id: 'camera', char: '📷' }, { id: 'island', char: '🏝️' },
] as const

export type EmojiId = (typeof COMMON_EMOJI)[number]['id']

/** Puts `emoji` at the caret (or over a selection), keeping the message within `max`. Returns the text and where the caret goes; nothing changes when it would not fit. */
export function insertEmoji(text: string, start: number, end: number, emoji: string, max: number): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, text.length))
  const to = Math.max(from, Math.min(end, text.length))
  const next = text.slice(0, from) + emoji + text.slice(to)
  if (next.length > max) return { text, caret: from }
  return { text: next, caret: from + emoji.length }
}

/** Shown only with a mouse or trackpad; a phone has its own emoji keyboard. */
export const wantsEmojiPicker = (finePointer: boolean, canHover: boolean): boolean => finePointer && canHover
