import { describe, expect, it } from 'vitest'
import { CUES, cuesAllowed, playCue } from './cues'

describe('confirmation cues', () => {
  it('play only when sounds are on and calm mode is off', () => {
    expect(cuesAllowed({ sounds: true, calm: false })).toBe(true)
    expect(cuesAllowed({ sounds: false, calm: false })).toBe(false)
    expect(cuesAllowed({ sounds: true, calm: true })).toBe(false)
  })
  it('stay short and quiet', () => {
    for (const notes of Object.values(CUES)) {
      expect(Math.max(...notes.map((n) => n.start + n.dur))).toBeLessThanOrEqual(0.16)
      for (const n of notes) expect(n.gain).toBeLessThanOrEqual(0.06)
    }
  })
  it('do nothing where there is no audio', () => {
    expect(playCue('confirm', { sounds: true, calm: false })).toBe(false)
  })
})
