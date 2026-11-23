import { describe, expect, it } from 'vitest'
import { packItems } from './useCruisePack'

const days = [{ day: 1, port: 'sea' }, { day: 2, port: 'nassau' }, { day: 3, port: 'sea' }]
const items = packItems({ id: 'me1', booker: 'bk1' }, days)

describe('the cruise pack', () => {
  it('has unique ids', () => { expect(new Set(items.map((i) => i.id)).size).toBe(items.length) })
  it('covers every kind a guest must open with no signal', () => {
    const kinds = new Set(items.map((i) => i.kind))
    for (const k of ['pass', 'muster', 'emergency', 'dining', 'folio', 'program', 'embark', 'receipt', 'health']) expect(kinds.has(k), k).toBe(true)
  })
  it('saves each day’s programme under the key the screen reads', () => {
    expect(items.filter((i) => i.kind === 'program').map((i) => i.key)).toEqual(['me1:1', 'me1:2', 'me1:3'])
  })
  it('lists shore tours for port days only, tagged with the port', () => {
    const tours = items.filter((i) => i.section === 'tours')
    expect(tours).toHaveLength(1)
    expect(tours[0]).toMatchObject({ key: 'me1:tours:2', port: 'nassau', day: 2 })
  })
  it('keys the booking-wide views by the booker and the personal ones by the person', () => {
    expect(items.find((i) => i.kind === 'pass')?.key).toBe('bk1')
    expect(items.find((i) => i.kind === 'emergency')?.key).toBe('me1')
    expect(items.find((i) => i.kind === 'health')?.key).toBe('me1')
  })
})
