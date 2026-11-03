import { describe, expect, it } from 'vitest'
import { nextSteps, stageTiles, TILE_STAGES } from './stageHome'

const none = { savedSailings: 0, draft: null }

describe('stage Home', () => {
  it('has three next steps for each rebuilt stage', () => {
    for (const s of TILE_STAGES) expect(nextSteps(s, none)).toHaveLength(3)
  })
  it('marks a step done only from data', () => {
    expect(nextSteps('dream', none).every((s) => !s.done)).toBe(true)
    expect(nextSteps('dream', { ...none, savedSailings: 1 })[1]!.done).toBe(true)
    expect(nextSteps('discover', { ...none, draft: { id: 'd1', categoryChosen: true, started: true } })[0]!.done).toBe(true)
  })
  it('opens the draft when there is one and the booking start when not', () => {
    expect(nextSteps('book', { ...none, draft: { id: 'd1', categoryChosen: true, started: true } })[0]!.to).toBe('/book/resume/d1')
    expect(nextSteps('book', none)[0]!.to).toBe('/book')
  })
  it('gives six tiles, each with an address, at every rebuilt stage', () => {
    for (const s of TILE_STAGES) expect(stageTiles(s, { sailingId: 'x', draftId: 'd1' })).toHaveLength(6)
    expect(stageTiles('book', { sailingId: null, draftId: null }).every((x) => !x.to.includes(':'))).toBe(true)
  })
})
