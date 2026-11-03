import { describe, expect, it } from 'vitest'
import { nextSteps, stageTiles, ABOARD_STAGES, TILE_STAGES, TRIP_STAGES } from './stageHome'

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
  it('builds the trip stages on the confirmed trip', () => {
    const trip = { number: 'B1', paid: true, documentsOk: false, checkinDone: true, agent: false }
    for (const s of TRIP_STAGES) {
      expect(nextSteps(s, { ...none, trip })).toHaveLength(3)
      expect(stageTiles(s, { sailingId: 'x', draftId: null })).toHaveLength(6)
    }
    expect(nextSteps('manage', { ...none, trip })[0]).toMatchObject({ done: true, to: '/book/pay/B1' })
    expect(nextSteps('manage', { ...none, trip })[1]!.done).toBe(false)
    expect(nextSteps('getToShip', { ...none, trip })[0]).toMatchObject({ done: true, to: '/home/boarding-pass' })
  })
  it('builds the on-board stages, with bag night only from the last full day', () => {
    for (const s of ABOARD_STAGES) expect(stageTiles(s, { sailingId: 'x', draftId: null })).toHaveLength(6)
    const early = { ...none, aboard: { musterDone: true, lastFullDay: false } }
    expect(nextSteps('embark', early)[2]).toMatchObject({ to: '/ship/muster', done: true })
    expect(nextSteps('sea', early)).toHaveLength(2)
    expect(nextSteps('sea', { ...none, aboard: { musterDone: true, lastFullDay: true } })[2]!.to).toBe('/home/disembark/bags')
    expect(nextSteps('port', none)).toHaveLength(3)
    expect(nextSteps('disembark', none)).toHaveLength(3)
  })
})
