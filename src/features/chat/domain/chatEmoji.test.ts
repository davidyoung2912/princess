import { describe, expect, it } from 'vitest'
import { COMMON_EMOJI, insertEmoji, wantsEmojiPicker } from './chatEmoji'

describe('emoji picker', () => {
  it('inserts at the caret and moves the caret past it', () => expect(insertEmoji('hello world', 5, 5, '🎉', 100)).toEqual({ text: 'hello🎉 world', caret: 7 }))
  it('replaces a selection', () => expect(insertEmoji('hello world', 6, 11, '🌊', 100)).toEqual({ text: 'hello 🌊', caret: 8 }))
  it('clamps a caret that is out of range', () => expect(insertEmoji('hi', 50, 60, '👍', 100)).toEqual({ text: 'hi👍', caret: 4 }))
  it('changes nothing when the message would be too long', () => expect(insertEmoji('abcd', 4, 4, '🎉', 5)).toEqual({ text: 'abcd', caret: 4 }))
  it('shows only with a mouse', () => {
    expect(wantsEmojiPicker(true, true)).toBe(true)
    expect(wantsEmojiPicker(false, false)).toBe(false)
    expect(wantsEmojiPicker(true, false)).toBe(false)
  })
  it('has unique ids and characters', () => {
    expect(new Set(COMMON_EMOJI.map((e) => e.id)).size).toBe(COMMON_EMOJI.length)
    expect(new Set(COMMON_EMOJI.map((e) => e.char)).size).toBe(COMMON_EMOJI.length)
  })
})
