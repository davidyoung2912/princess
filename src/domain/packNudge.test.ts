import { describe, expect, it } from 'vitest'
import { packNudge } from './packNudge'

const DAY = 86_400_000
const done = (at: number, failed = 0) => ({ at, total: 10, failed: Array.from({ length: failed }, (_, i) => ({ id: String(i), label: '', code: 'x' })) })

describe('download nudge', () => {
  it('is silent away from sailing', () => {
    expect(packNudge('dream', null, 0)).toBe('none')
    expect(packNudge('sea', null, 0)).toBe('none')
  })
  it('asks once when nothing was downloaded', () => { expect(packNudge('prebook', null, 0)).toBe('first') })
  it('asks again when the download is old', () => { expect(packNudge('getToShip', done(0), 4 * DAY)).toBe('again') })
  it('asks to finish a partial download', () => { expect(packNudge('prebook', done(0, 2), DAY)).toBe('finish') })
  it('is silent after a complete, recent download', () => { expect(packNudge('prebook', done(0), DAY)).toBe('none') })
})
