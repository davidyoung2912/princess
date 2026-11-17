import { describe, expect, it } from 'vitest'
import { normalizeAutoRun } from './stanleyAuto'

const m = (key: string, dueAt = '2027-01-13T17:00:00Z') => ({ key, text: 'Your final payment is due in 7 days.', dueAt, receipt: 'STN-ABCD1234' })

describe('normalizeAutoRun', () => {
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizeAutoRun(null)).toBeNull()
    expect(normalizeAutoRun({ made: [] })).toBeNull()
  })
  it('keeps the server order and what was made', () => {
    expect(normalizeAutoRun({ on: true, made: [m('b'), m('a')] })!.made.map((x) => x.key)).toEqual(['b', 'a'])
  })
  it('drops a reminder with no key or an unreadable time', () => {
    const r = normalizeAutoRun({ on: true, made: [m(''), m('a', 'soon'), m('c')] })!
    expect(r.made.map((x) => x.key)).toEqual(['c'])
  })
  it('says off when the guest has not switched it on', () => {
    expect(normalizeAutoRun({ on: false, made: [], waiting: [], notChecked: ['x'] })).toMatchObject({ on: false, made: [], notChecked: ['x'] })
  })
})
