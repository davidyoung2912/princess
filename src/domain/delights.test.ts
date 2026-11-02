import { describe, expect, it } from 'vitest'
import {
  chargeReminderTime, feetOf, groupBookingNumber, LAST_LOOK_ITEMS, lastLookLeft, nameWarnings, outOfOffice, pricePer, shipInFamiliarTerms, ticketName,
  tippingNorm, watchGap,
} from './delights'

describe('ticketName and nameWarnings (D2-1, D2-2)', () => {
  it('prints LAST/FIRST in capitals and tidies spaces', () => {
    expect(ticketName('  jane  ann ', 'smith')).toBe('SMITH/JANE ANN')
    expect(ticketName('', 'Smith')).toBe('SMITH')
    expect(ticketName('', '')).toBe('')
  })
  it('flags both names in one field, titles, digits, quotes and initials', () => {
    expect(nameWarnings('Jane Smith', '')).toContain('bothInOne')
    expect(nameWarnings('Mrs Jane', 'Smith')).toContain('title')
    expect(nameWarnings('Dr. Jane', 'Smith')).toContain('title')
    expect(nameWarnings('Jane2', 'Smith')).toContain('digits')
    expect(nameWarnings('Jane "Janey"', 'Smith')).toContain('quotes')
    expect(nameWarnings('J', 'Smith')).toContain('initial')
  })
  it('suggests a swap only when the last name looks like a given name and the first does not', () => {
    expect(nameWarnings('Smith', 'David')).toContain('maybeSwapped')
    expect(nameWarnings('David', 'Smith')).toEqual([])
    expect(nameWarnings('Mary', 'David')).toEqual([])
  })
  it('says nothing about an ordinary name or an empty form', () => {
    expect(nameWarnings('Jane', 'Smith')).toEqual([])
    expect(nameWarnings('', '')).toEqual([])
  })
  it('does not call a lone one-word name a title', () => {
    expect(nameWarnings('Miss', '')).toEqual([])
  })
})

describe('groupBookingNumber (D2-3)', () => {
  it('groups in fours and spaces the characters for a screen reader', () => {
    const g = groupBookingNumber('pr-4821-7733')
    expect(g.raw).toBe('PR48217733')
    expect(g.display).toBe('PR48 2177 33')
    expect(g.spoken).toBe('P R 4 8 2 1 7 7 3 3')
  })
  it('copes with an empty number', () => {
    expect(groupBookingNumber('')).toEqual({ display: '', spoken: '', raw: '' })
  })
})

describe('shipInFamiliarTerms (D1-1)', () => {
  it('reads feet from text and rounds to pitches and a town', () => {
    expect(feetOf('1,133 ft')).toBe(1133)
    expect(feetOf('nonsense')).toBe(0)
    expect(shipInFamiliarTerms('1,133 ft', 4300, 1600)).toEqual({ pitches: 3, town: 5900 })
  })
  it('returns zero pitches when the length is unknown and never fewer than one otherwise', () => {
    expect(shipInFamiliarTerms('?', 10, 0).pitches).toBe(0)
    expect(shipInFamiliarTerms(100, 0, 0)).toEqual({ pitches: 1, town: 0 })
  })
})

describe('pricePer (D1-3)', () => {
  it('splits a total by guests and nights', () => {
    expect(pricePer(4200, 2, 7, 'total')).toBe(4200)
    expect(pricePer(4200, 2, 7, 'person')).toBe(2100)
    expect(pricePer(4200, 2, 7, 'personNight')).toBe(300)
  })
  it('never divides by zero and ignores a missing price', () => {
    expect(pricePer(700, 0, 0, 'personNight')).toBe(700)
    expect(pricePer(0, 2, 7, 'person')).toBe(0)
    expect(pricePer(Number.NaN, 2, 7, 'person')).toBe(0)
  })
})

describe('tippingNorm (D6A-5)', () => {
  it('has a norm for each guide port and none for others', () => {
    for (const p of ['cozumel', 'belize', 'roatan']) expect(tippingNorm(p)?.country).toBeTruthy()
    expect(tippingNorm('sea')).toBeUndefined()
    expect(tippingNorm('toString')).toBeUndefined()
  })
})

describe('outOfOffice (D3-7)', () => {
  const tpl = { friendly: 'Hi! {name} is away on a ship until {date}.', formal: 'I am away until {date}.', brief: 'Away until {date}.' }
  it('fills the name and date and keeps the chosen tone', () => {
    expect(outOfOffice(tpl, 'friendly', ' Jo ', '4 Mar')).toBe('Hi! Jo is away on a ship until 4 Mar.')
    expect(outOfOffice(tpl, 'brief', 'Jo', '4 Mar')).toBe('Away until 4 Mar.')
  })
})

describe('lastLookLeft (D4A-3)', () => {
  it('counts what is left and ignores unknown ids', () => {
    expect(lastLookLeft([])).toEqual({ left: LAST_LOOK_ITEMS.length, ready: false })
    expect(lastLookLeft(['passport', 'other'])).toEqual({ left: LAST_LOOK_ITEMS.length - 1, ready: false })
    expect(lastLookLeft([...LAST_LOOK_ITEMS])).toEqual({ left: 0, ready: true })
  })
})

describe('watchGap (D4A-7)', () => {
  const at = Date.UTC(2027, 0, 15, 12)
  it('is the difference between two zones, positive when the ship is ahead', () => {
    expect(watchGap(at, 'America/Los_Angeles', 'America/New_York')).toEqual({ minutes: 180, same: false })
    expect(watchGap(at, 'America/New_York', 'America/Chicago').minutes).toBe(-60)
  })
  it('is the same in the same zone', () => {
    expect(watchGap(at, 'America/New_York', 'America/New_York').same).toBe(true)
  })
})

describe('chargeReminderTime (D7-3)', () => {
  it('uses the usual evening hour with no deadline or a late one', () => {
    expect(chargeReminderTime()).toBe('21:00')
    expect(chargeReminderTime('23:30')).toBe('21:00')
    expect(chargeReminderTime('nonsense')).toBe('21:00')
  })
  it('goes two hours before an earlier deadline', () => {
    expect(chargeReminderTime('22:00')).toBe('20:00')
    expect(chargeReminderTime('21:15')).toBe('19:15')
  })
  it('falls back when two hours before would be before midnight', () => {
    expect(chargeReminderTime('01:00')).toBe('21:00')
  })
})
