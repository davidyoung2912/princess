import { describe, expect, it } from 'vitest'
import { followUps, MAX_FOLLOW } from './stanleyFollow'
import { LIBRARY, questionOf } from './stanleyLibrary'

describe('followUps', () => {
  it('offers at most two questions for the stage', () => {
    const list = followUps('dream', [])
    expect(list.length).toBeGreaterThan(0)
    expect(list.length).toBeLessThanOrEqual(MAX_FOLLOW)
    for (const e of list) expect(e.stages).toContain('dream')
  })
  it('leaves out what was already asked and the entry just shown', () => {
    const first = followUps('dream', [])
    const next = followUps('dream', [questionOf(first[0])], first[0])
    expect(next.map((e) => e.id)).not.toContain(first[0].id)
  })
  it('starts with entries written for the same screens as the one just answered', () => {
    const from = LIBRARY.find((e) => e.stages.includes('dream') && e.screens.length > 0 && LIBRARY.some((o) => o.id !== e.id && o.stages.includes('dream') && o.screens.some((s) => e.screens.includes(s))))
    if (!from) return
    const [first] = followUps('dream', [], from)
    expect(first.screens.some((s) => from.screens.includes(s))).toBe(true)
  })
  it('gives none for a stage with no library', () => {
    expect(followUps('remember', ['x']).length).toBeLessThanOrEqual(MAX_FOLLOW)
  })
})
