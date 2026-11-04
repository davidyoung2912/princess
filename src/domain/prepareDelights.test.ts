import { describe, expect, it } from 'vitest'
import {
  canSaveTraveller, cleanNickname, EMPTY_PREPARE, forgetTraveller, homeRates, normalizePrepare, passportByPort, rankPorts, recapMailto, remindFrom, reminderState,
  emailCheckDue, applyEntry, normalizeEntry, ringDash, saveTraveller, smallThing, SMALL_THINGS, unusedSaved, weeksOut, withNickname, worstEntry, SAVED_MAX, REMIND_DAYS,
} from './prepareDelights'
import { SAILINGS } from './sailings'
import { SAMPLE_TABLE } from './rates'

const sailing = SAILINGS[0]

describe('ringDash', () => {
  it('fills in proportion and clamps', () => {
    const half = ringDash(50)
    expect(half.filled).toBeCloseTo(half.circumference / 2, 1)
    expect(ringDash(-5).filled).toBe(0)
    expect(ringDash(250).filled).toBe(ringDash(100).circumference)
    expect(ringDash(NaN).filled).toBe(0)
  })
})

describe('smallThing', () => {
  it('is quiet before the first task is due and after sailing', () => {
    expect(smallThing(26 * 7 + 7, [], false)).toBeNull()
    expect(smallThing(0, [], false)).toBeNull()
    expect(smallThing(-3, [], false)).toBeNull()
  })
  it('starts with the passport and moves on when it is done', () => {
    expect(smallThing(15 * 7, [], false)?.id).toBe('passport')
    expect(smallThing(15 * 7, ['passport'], false)?.id).toBe('names')
  })
  it('puts the oldest missed task first', () => {
    expect(smallThing(3 * 7, ['names'], false)?.id).toBe('passport')
  })
  it('never speaks once turned off, or when everything is done', () => {
    expect(smallThing(10, [], true)).toBeNull()
    expect(smallThing(10, SMALL_THINGS.map((x) => x.id), false)).toBeNull()
  })
  it('counts whole weeks rounded up', () => {
    expect(weeksOut(7)).toBe(1)
    expect(weeksOut(8)).toBe(2)
    expect(weeksOut(-1)).toBe(0)
  })
})

describe('passportByPort', () => {
  it('rejects a date that is not a date', () => {
    expect(passportByPort('soon', sailing)).toBeNull()
  })
  it('passes a passport good for years', () => {
    const c = passportByPort('2035-01-01', sailing)!
    expect(c.length).toBeGreaterThan(0)
    expect(worstEntry(c)).toBe('ok')
  })
  it('finds a passport that expires during the trip', () => {
    const c = passportByPort(sailing.departure, sailing)!
    expect(c.some((x) => x.status === 'expired')).toBe(true)
    expect(worstEntry(c)).toBe('expired')
  })
  it('flags the six-month ports before the others', () => {
    const d = new Date(`${sailing.departure}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + 3)
    const c = passportByPort(d.toISOString().slice(0, 10), sailing)!
    expect(c.find((x) => x.port === 'cozumel')?.status).toBe('ok')
    expect(c.find((x) => x.port === 'belize')?.status).toBe('tooSoon')
    expect(worstEntry(c)).toBe('tooSoon')
    expect(new Set(c.map((x) => x.port)).size).toBe(c.length)
  })
})

describe('entry rules by citizenship', () => {
  const rules = [
    { country: 'US', monthsUs: 0, monthsOther: 0, visaCheckOther: true },
    { country: 'MX', monthsUs: 0, monthsOther: 0, visaCheckOther: true },
    { country: 'BZ', monthsUs: 3, monthsOther: 6, visaCheckOther: true },
    { country: 'HN', monthsUs: 3, monthsOther: 6, visaCheckOther: false },
  ] as const
  const d = new Date(`${sailing.departure}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 5)
  const fiveMonths = d.toISOString().slice(0, 10)
  it('reads the months for the citizenship', () => {
    expect(passportByPort(fiveMonths, sailing, 'us', rules)!.find((c) => c.port === 'belize')?.status).toBe('ok')
    expect(passportByPort(fiveMonths, sailing, 'other', rules)!.find((c) => c.port === 'belize')?.status).toBe('tooSoon')
  })
  it('asks only a guest of another nationality to check for a visa, where the table says so', () => {
    expect(passportByPort(fiveMonths, sailing, 'us', rules)!.some((c) => c.visaCheck)).toBe(false)
    const other = passportByPort(fiveMonths, sailing, 'other', rules)!
    expect(other.find((c) => c.port === 'belize')?.visaCheck).toBe(true)
    expect(other.find((c) => c.port === 'roatan')?.visaCheck).toBe(false)
  })
  it('uses the served table when it arrives and the authored one when it is bad', () => {
    expect(normalizeEntry(null)).toBeNull()
    expect(normalizeEntry({ version: 'v', rules: [{ country: 'mars', monthsUs: 1, monthsOther: 1 }, { country: 'BZ', monthsUs: 99, monthsOther: 1 }] })).toBeNull()
    const served = normalizeEntry({ version: 'v1', rules: [{ country: 'BZ', monthsUs: 1, monthsOther: 2, visaCheckOther: true }, { country: 'BZ', monthsUs: 9, monthsOther: 9 }] })!
    expect(served.rules).toEqual([{ country: 'BZ', monthsUs: 1, monthsOther: 2, visaCheckOther: true }])
    const linked = normalizeEntry({ version: 'v2', rules: [
      { country: 'BZ', monthsUs: 1, monthsOther: 2, source: 'https://immigration.gov.bz', asOf: '2026-11-03' },
      { country: 'HN', monthsUs: 1, monthsOther: 2, source: 'javascript:alert(1)', asOf: 'last week' },
    ] })!
    expect(linked.rules[0]).toMatchObject({ source: 'https://immigration.gov.bz', asOf: '2026-11-03' })
    expect(linked.rules[1]).not.toHaveProperty('source')
    expect(linked.rules[1]).not.toHaveProperty('asOf')
    applyEntry(served)
    try {
      expect(passportByPort('2035-01-01', sailing, 'us')!.map((c) => c.port)).toEqual(['belize'])
    } finally {
      applyEntry(null)
    }
    expect(passportByPort('2035-01-01', sailing, 'us')!.length).toBe(4)
  })
})

describe('homeRates', () => {
  it('shows a hundred dollars at home and in the ports with the table date', () => {
    const h = homeRates(SAMPLE_TABLE, 'EUR')
    expect(h.asOf).toBe(SAMPLE_TABLE.asOf)
    expect(h.home).toMatch(/^€92\.00$/)
    expect(h.ports.map((p) => p.code)).toEqual(['MXN', 'BZD', 'HNL'])
  })
  it('falls back to dollars for an unknown code', () => {
    expect(homeRates(SAMPLE_TABLE, 'XYZ').home).toBe('$100.00')
  })
})

describe('nickname', () => {
  it('trims, collapses and limits', () => {
    expect(cleanNickname("  Mum's   70th ")).toBe("Mum's 70th")
    expect(cleanNickname('x'.repeat(100))).toHaveLength(40)
    expect(cleanNickname(5)).toBe('')
    expect(cleanNickname('<b>hi</b>')).toBe('bhi/b')
  })
  it('goes in front of a title only when there is one', () => {
    expect(withNickname('Mum', '7 nights')).toBe('Mum: 7 nights')
    expect(withNickname('', '7 nights')).toBe('7 nights')
  })
})

describe('rankPorts', () => {
  it('keeps the voyage order with nothing picked', () => {
    expect(rankPorts([]).map((m) => m.port)).toEqual(['cozumel', 'belize', 'roatan'])
  })
  it('puts the best match first and says why', () => {
    const r = rankPorts(['wildlife', 'reef'])
    expect(r[0].port).toBe('belize')
    expect(r[0].matched).toEqual(['reef', 'wildlife'].sort((a, b) => ['history', 'wildlife', 'reef'].indexOf(a) - ['history', 'wildlife', 'reef'].indexOf(b)))
    expect(rankPorts(['market'])[0].port).toBe('cozumel')
  })
})

describe('reminder', () => {
  it('is due after a week, never before', () => {
    const r = remindFrom(1000, 's1')
    expect(reminderState(null, 5)).toBe('none')
    expect(reminderState(r, 1000 + REMIND_DAYS * 86_400_000 - 1)).toBe('waiting')
    expect(reminderState(r, 1000 + REMIND_DAYS * 86_400_000)).toBe('due')
  })
})

describe('reminder email', () => {
  it('asks the server to check only when an email was asked for and the time has come', () => {
    const at = REMIND_DAYS * 86_400_000
    expect(emailCheckDue(null, at)).toBe(false)
    expect(emailCheckDue(remindFrom(0, 's1'), at)).toBe(false)
    expect(emailCheckDue(remindFrom(0, 's1', true), at - 1)).toBe(false)
    expect(emailCheckDue(remindFrom(0, 's1', true), at)).toBe(true)
  })
  it('keeps the email flag through normalising, and defaults it off', () => {
    expect(normalizePrepare({ remind: { at: 5, sailingId: 's', email: true } }).remind?.email).toBe(true)
    expect(normalizePrepare({ remind: { at: 5, sailingId: 's' } }).remind?.email).toBe(false)
  })
})

describe('saved travellers', () => {
  const g = { firstName: ' Jane ', lastName: 'Smith', dob: '1980-02-03', citizenship: 'us' as const }
  it('needs both names and a real date', () => {
    expect(canSaveTraveller(g)).toBe(true)
    expect(canSaveTraveller({ ...g, dob: '' })).toBe(false)
    expect(canSaveTraveller({ ...g, lastName: ' ' })).toBe(false)
  })
  it('updates the same person instead of adding twice', () => {
    const one = saveTraveller([], g, 'a')
    const two = saveTraveller(one, { ...g, firstName: 'JANE', citizenship: 'other' }, 'b')
    expect(two).toHaveLength(1)
    expect(two[0].id).toBe('a')
    expect(two[0].citizenship).toBe('other')
  })
  it('stops at the limit and forgets on request', () => {
    let list = [] as ReturnType<typeof saveTraveller>
    for (let i = 0; i < SAVED_MAX + 2; i++) list = saveTraveller(list, { ...g, firstName: `P${i}` }, `id${i}`)
    expect(list).toHaveLength(SAVED_MAX)
    expect(forgetTraveller(list, 'id0')).toHaveLength(SAVED_MAX - 1)
  })
  it('offers only people not already on the form', () => {
    const list = saveTraveller(saveTraveller([], g, 'a'), { ...g, firstName: 'Tom' }, 'b')
    expect(unusedSaved(list, [{ firstName: 'jane', lastName: 'smith', dob: '1980-02-03' }]).map((x) => x.id)).toEqual(['b'])
  })
})

describe('recapMailto', () => {
  it('encodes the subject and body', () => {
    const m = recapMailto('mum@example.com', 'Our trip', 'Line 1\nLine & 2')
    expect(m.startsWith('mailto:mum@example.com?subject=Our%20trip&body=')).toBe(true)
    expect(m).toContain('Line%201%0ALine%20%26%202')
  })
  it('drops an address that is not one, and cuts a long body', () => {
    expect(recapMailto('nonsense', 's', 'b').startsWith('mailto:?subject=')).toBe(true)
    expect(decodeURIComponent(recapMailto('', 's', 'x'.repeat(5000)).split('body=')[1]).length).toBeLessThanOrEqual(1500)
  })
})

describe('normalizePrepare', () => {
  it('gives the empty state for rubbish', () => {
    expect(normalizePrepare(null)).toEqual(EMPTY_PREPARE)
    expect(normalizePrepare('x')).toEqual(EMPTY_PREPARE)
  })
  it('keeps what is valid and drops the rest', () => {
    const p = normalizePrepare({
      smallDone: ['passport', 'passport', 'nope'], smallOff: true, homeCurrency: 'GBP', nickname: ' Mum ', moods: ['reef', 'reef', 'x'],
      remind: { at: 5, sailingId: 's1' }, travellers: [{ id: 'a', firstName: 'A', lastName: 'B', dob: '1990-01-01', citizenship: 'zz' }, { id: 'b', firstName: '', lastName: 'B', dob: '1990-01-01' }],
    })
    expect(p.smallDone).toEqual(['passport'])
    expect(p.smallOff).toBe(true)
    expect(p.homeCurrency).toBe('GBP')
    expect(p.nickname).toBe('Mum')
    expect(p.moods).toEqual(['reef'])
    expect(p.remind).toEqual({ at: 5, sailingId: 's1', email: false })
    expect(p.travellers).toEqual([{ id: 'a', firstName: 'A', lastName: 'B', dob: '1990-01-01', citizenship: '' }])
  })
  it('rejects a bad currency and a bad reminder', () => {
    const p = normalizePrepare({ homeCurrency: 'ZZZ', remind: { at: 'soon' } })
    expect(p.homeCurrency).toBe('USD')
    expect(p.remind).toBeNull()
  })
})

describe('prepare in the memory document', () => {
  it('survives a save and load, and is part of what syncs', async () => {
    const { normalizeMemory, EMPTY_MEMORY, restOf } = await import('../memory/store')
    const m = { ...EMPTY_MEMORY, prepare: normalizePrepare({ nickname: 'Mum', moods: ['reef'], travellers: [{ id: 'a', firstName: 'A', lastName: 'B', dob: '1990-01-01', citizenship: 'us' }] }) }
    const back = normalizeMemory(JSON.parse(JSON.stringify(restOf(m))))
    expect(back.prepare.nickname).toBe('Mum')
    expect(back.prepare.moods).toEqual(['reef'])
    // Saved travellers and the reminder have their own documents, so the memory document carries neither.
    expect(back.prepare.travellers).toEqual([])
    expect(back.prepare.remind).toBeNull()
  })
})
