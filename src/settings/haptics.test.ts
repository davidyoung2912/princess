import { describe, expect, it } from 'vitest'
import { mayVibrate } from './haptics'

describe('haptics', () => {
  it('buzzes only when the device can and nothing asks for calm or less motion', () => {
    expect(mayVibrate({ calm: false, reduceMotion: false }, false, true)).toBe(true)
    expect(mayVibrate({ calm: true, reduceMotion: false }, false, true)).toBe(false)
    expect(mayVibrate({ calm: false, reduceMotion: true }, false, true)).toBe(false)
    expect(mayVibrate({ calm: false, reduceMotion: false }, true, true)).toBe(false)
    expect(mayVibrate({ calm: false, reduceMotion: false }, false, false)).toBe(false)
  })
})
