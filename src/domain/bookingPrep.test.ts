import { describe, expect, it } from 'vitest'
import { acknowledgedAt, allergySteps, accessNotes, EMPTY_ACCESS, galleyStatus, holdState, ledgerSummary, leftInWords, normalizeAllergy, normalizeHold, personReadiness, priceWatch, splitEven, tripContract } from './bookingPrep'
import { buildChecklist } from './checklist'

const H = 3_600_000
const plan = { total: 400000, deposit: 100000, balance: 300000, finalDue: '2027-01-10', booked: '2026-10-01' }

describe('hold', () => {
  it('is active for 48 hours then lapses, in words', () => {
    const hold = normalizeHold({ label: ' Balcony ', at: 0 })!
    expect(holdState(null, 5).state).toBe('none')
    expect(holdState(hold, 47 * H).state).toBe('active')
    expect(holdState(hold, 48 * H).state).toBe('lapsed')
    expect(leftInWords(29 * H)).toBe('1 day 5 hours')
    expect(leftInWords(10)).toBe('less than a minute')
    expect(normalizeHold({ label: '  ', at: 1 })).toBeNull()
  })
})

describe('access', () => {
  it('asks nothing of any area when empty, and reads the profile otherwise', () => {
    expect(Object.values(accessNotes(EMPTY_ACCESS)).flat()).toEqual([])
    const n = accessNotes({ ...EMPTY_ACCESS, device: 'wheelchair', hearing: true })
    expect(n.cabin).toEqual(expect.arrayContaining(['wideDoor', 'visualAlerts']))
    expect(n.excursions).toContain('ramps')
  })
})

describe('contract', () => {
  it('has six sections with what is paid and not', () => {
    const s = tripContract({ number: 'A1', name: 'Sam', departure: '2027-04-01', guests: 2, category: 'Balcony', plan, balancePaid: false, today: '2026-11-01' })
    expect(s.map((x) => x.id)).toEqual(['booking', 'paid', 'notPaid', 'rules', 'deadlines', 'contact'])
    expect(s[2].lines[0]).toMatch(/\$3,000/)
  })
})

describe('readiness', () => {
  it('weights papers first and gives each person their own number', () => {
    const entries = buildChecklist({ departure: '2027-04-01', today: '2026-11-01', daysToDeparture: 151, auto: { paid: true, documents: true, tours: false, dining: false, assistance: false, travel: false, checkin: false }, ticked: [] })
    const ok = personReadiness(entries, 0), bad = personReadiness(entries, 1)
    expect(ok.percent).toBeGreaterThan(bad.percent)
    expect(bad.open[0].papers).toBe(true)
  })
})

describe('allergy, ledger, watch', () => {
  it('simulates a galley reply after twelve hours', () => {
    const f = normalizeAllergy({ items: ['Peanuts', 'peanuts', ' '], at: 0 })
    expect(f.items).toEqual(['Peanuts'])
    expect(galleyStatus(f, H)).toBe('noted')
    expect(galleyStatus(f, 12 * H)).toBe('acknowledged')
    expect(galleyStatus(normalizeAllergy({}), 0)).toBe('notSent')
  })
  it('splits to the cent and totals who paid', () => {
    const parts = splitEven(100, ['a', 'b', 'c'])
    expect(parts.reduce((a, p) => a + p.amount, 0)).toBe(100)
    expect(ledgerSummary(parts.map((p, i) => ({ id: String(i), ...p, paid: i === 0 })))).toEqual({ paid: 34, owed: 66, total: 100 })
  })
  it('allows re-pricing only before the final date', () => {
    const b = { plan, guests: 2, today: '2026-12-20', departure: '2027-04-01', balancePaid: false, finalDays: 81 }
    const w = priceWatch(b, [{ date: '2026-12-20', total: 380000 }])!
    expect(w.drop).toEqual({ ok: true, saving: 20000, newTotal: 380000 })
    expect(priceWatch({ ...b, today: '2027-02-01' }, [{ date: 'x', total: 380000 }])!.steps).toEqual([])
  })
})

describe('access profile and account needs share four answers', () => {
  it('sets the shared needs from the access flags and keeps the others', async () => {
    const { needsWithAccess, accessWithNeeds, EMPTY_ACCESS } = await import('./bookingPrep')
    expect(needsWithAccess(['cpap', 'hearing'], { ...EMPTY_ACCESS, mobility: true })).toEqual(['cpap', 'mobility'])
    const a = accessWithNeeds({ ...EMPTY_ACCESS, sensory: true, device: 'cane' }, ['hearing', 'oxygen'])
    expect(a).toMatchObject({ hearing: true, mobility: false, sensory: true, device: 'cane' })
  })
})

describe('allergy tracking', () => {
  const f = normalizeAllergy({ items: ['peanuts'], at: 0 })
  it('shows steps only once flagged', () => {
    expect(allergySteps('notSent')).toEqual([])
    expect(allergySteps('noted').map((s) => s.state)).toEqual(['done', 'done', 'current'])
    expect(allergySteps('acknowledged').map((s) => s.state)).toEqual(['done', 'done', 'done'])
  })
  it('gives the acknowledgement time only after it happens', () => {
    expect(acknowledgedAt(f, 3_600_000)).toBeNull()
    expect(acknowledgedAt(f, 13 * 3_600_000)).toBe(12 * 3_600_000)
  })
})
