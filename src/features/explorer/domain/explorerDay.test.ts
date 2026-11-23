import { describe, expect, it } from 'vitest'
import { dayChoices, parseDay, resolveExplorerDay, stepDay } from './explorerDay'

describe('parseDay', () => {
  it('takes whole days inside the sailing', () => {
    expect(parseDay('3', 8)).toBe(3)
    expect(parseDay(8, 8)).toBe(8)
  })
  it('refuses everything else', () => {
    for (const bad of ['0', '9', '-1', '2.5', '3x', '', ' 3', null, undefined, NaN, 2.5]) expect(parseDay(bad, 8)).toBeNull()
  })
})

describe('resolveExplorerDay', () => {
  const base = { currentDay: 4, total: 8 }
  it('prefers the address, then the remembered day, then the ship day', () => {
    expect(resolveExplorerDay({ ...base, requested: '6', remembered: 2 })).toBe(6)
    expect(resolveExplorerDay({ ...base, requested: null, remembered: 2 })).toBe(2)
    expect(resolveExplorerDay({ ...base, requested: null, remembered: null })).toBe(4)
  })
  it('skips an invalid address or remembered day', () => {
    expect(resolveExplorerDay({ ...base, requested: '99', remembered: 2 })).toBe(2)
    expect(resolveExplorerDay({ ...base, requested: 'x', remembered: 99 })).toBe(4)
  })
  it('keeps the ship day inside the sailing', () => {
    expect(resolveExplorerDay({ requested: null, remembered: null, currentDay: 12, total: 8 })).toBe(8)
    expect(resolveExplorerDay({ requested: null, remembered: null, currentDay: 0, total: 8 })).toBe(1)
  })
})

describe('stepDay', () => {
  it('stops at the ends', () => {
    expect(stepDay(1, -1, 8)).toBe(1)
    expect(stepDay(8, 1, 8)).toBe(8)
    expect(stepDay(3, 1, 8)).toBe(4)
  })
})

describe('dayChoices', () => {
  it('marks sea days, today and the past', () => {
    const c = dayChoices([{ port: 'home', date: '2027-03-21' }, { port: 'sea', date: '2027-03-22' }, { port: 'a', date: '2027-03-23' }], 2)
    expect(c.map((x) => [x.day, x.atSea, x.isToday, x.isPast])).toEqual([[1, false, false, true], [2, true, true, false], [3, false, false, false]])
  })
})
