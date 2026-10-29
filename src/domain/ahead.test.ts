import { describe, expect, it } from 'vitest'
import {
  ADVISORS, CLUBS, DEFAULT_QUIZ, GIFTS_FOR, MIN_PAID, advisorProblem, advisorsFor, applyPerks, assistProblem, assistStage, bagStage, bidProblem, bidWins, blankRegistration, clubForAge,
  clubProblem, compassionTerms, consentCode, consentState, contactProblem, doubleOptInFor, loyaltyNumberOf, loyaltyNumberOk, medallionStatus, recommend, tagProblem, tierForNumber, upgradeOffers,
} from './ahead'
import { DATA_RULES, dataRuleProblems } from './dataRules'
import { CLEARANCE, CLIMATE, FIX_FLOWS, PREP, clearanceFor, formatTemp, isHurricaneSeason, outlook, prepDue, toCelsius, uvBand } from './readiness'
import { itemById } from './catalogue'
import { PERSONAS } from './personas'
import { addDays } from './timezones'

const HOUR = 3_600_000
const DAY = 24 * HOUR

describe('find my cruise quiz (DIS-06)', () => {
  it('gives the same shortlist for the same answers, best first', () => {
    const a = { ...DEFAULT_QUIZ, musts: ['balcony' as const] }
    expect(recommend(a)).toEqual(recommend(a))
    const r = recommend(a)
    expect(r.picks.length).toBeGreaterThan(0)
    for (let i = 1; i < r.picks.length; i++) expect(r.picks[i - 1].score).toBeGreaterThanOrEqual(r.picks[i].score)
    expect(['balcony', 'miniSuite', 'sanctuaryMiniSuite', 'signatureSuite']).toContain(r.picks[0].category)
  })

  it('follows budget, never offers the adults-only suites to a family, and suggests a package', () => {
    expect(recommend({ ...DEFAULT_QUIZ, budget: 'value', with: 'solo' }).picks[0].category).toBe('interior')
    const family = recommend({ ...DEFAULT_QUIZ, budget: 'treat', with: 'family', musts: ['quiet'] })
    expect(family.picks.some((p) => p.category === 'sanctuaryMiniSuite')).toBe(false)
    expect(recommend({ ...DEFAULT_QUIZ, musts: ['quiet'], budget: 'treat' }).picks[0].category).toBe('sanctuaryMiniSuite')
    expect(recommend({ ...DEFAULT_QUIZ, musts: ['drinks', 'dining'] }).package).toBe('premier')
    expect(recommend({ ...DEFAULT_QUIZ, musts: ['drinks'] }).package).toBe('plus')
    expect(recommend({ ...DEFAULT_QUIZ }).package).toBe('none')
  })

  it('adds the notes that apply', () => {
    expect(recommend({ ...DEFAULT_QUIZ, mobility: 'wheelchair' }).notes).toEqual(['accessible', 'tender'])
    expect(recommend({ ...DEFAULT_QUIZ, with: 'family' }).notes).toContain('clubs')
    expect(recommend(DEFAULT_QUIZ).notes).toEqual([])
  })
})

describe('advisors (DIS-15)', () => {
  it('filters by speciality and language', () => {
    expect(advisorsFor({})).toHaveLength(ADVISORS.length)
    expect(advisorsFor({ language: 'Spanish' }).map((a) => a.id)).toEqual(['adv-ocean'])
    expect(advisorsFor({ speciality: 'accessible' })[0].id).toBe('adv-ease')
    expect(advisorsFor({ speciality: 'groups', language: 'Spanish' })).toEqual([])
  })

  it('checks a request', () => {
    expect(advisorProblem('adv-ocean', 'chat', '', 'Which room is quietest?')).toBeNull()
    expect(advisorProblem('adv-ocean', 'callback', '305-555-0100', 'Which room is quietest?')).toBeNull()
    expect(advisorProblem('nope', 'chat', '', 'Which room?')).toBe('badAdvisor')
    expect(advisorProblem('adv-ocean', 'fax', '', 'Which room?')).toBe('badWay')
    expect(advisorProblem('adv-ocean', 'callback', '123', 'Which room?')).toBe('badPhone')
    expect(advisorProblem('adv-ocean', 'chat', '', 'hi')).toBe('noQuestion')
  })
})

describe('marketing consent (DIS-16)', () => {
  it('asks for a second step where the law does', () => {
    expect(doubleOptInFor('us')).toBe(false)
    expect(doubleOptInFor('uk')).toBe(true)
    expect(doubleOptInFor('ca')).toBe(true)
    expect(doubleOptInFor('eu')).toBe(true)
  })

  it('checks contacts, makes a stable code, and lets an unconfirmed ask lapse', () => {
    expect(contactProblem('email', 'a@b.co')).toBeNull()
    expect(contactProblem('email', 'nope')).toBe('badEmail')
    expect(contactProblem('sms', '305-555-0100')).toBeNull()
    expect(contactProblem('sms', '55')).toBe('badPhone')
    expect(consentCode('A@b.co')).toBe(consentCode(' a@b.co '))
    expect(consentCode('a@b.co')).toMatch(/^\d{6}$/)
    const r = { channel: 'email' as const, contact: 'a@b.co', region: 'uk' as const, askedAt: 0, confirmedAt: null }
    expect(consentState(r, HOUR)).toBe('pending')
    expect(consentState(r, 25 * HOUR)).toBe('expired')
    expect(consentState({ ...r, confirmedAt: 5 }, 99 * DAY)).toBe('confirmed')
  })
})

describe('Captain’s Circle and credit at booking (BOK-11, BOK-12)', () => {
  it('makes valid numbers, and catches a typo', () => {
    for (const p of PERSONAS) expect(loyaltyNumberOk(loyaltyNumberOf(p.id)), p.id).toBe(true)
    const n = loyaltyNumberOf('gerald')
    const typo = `${n.slice(0, 4)}${(Number(n[4]) + 1) % 10}${n.slice(5)}`
    expect(loyaltyNumberOk(typo)).toBe(false)
    expect(loyaltyNumberOk('CC12')).toBe(false)
    expect(loyaltyNumberOk(42)).toBe(false)
  })

  it('gives your own level for your own number and Gold for any other valid number', () => {
    expect(tierForNumber(loyaltyNumberOf('gerald'), 'gerald', 'platinum')).toBe('platinum')
    expect(tierForNumber(loyaltyNumberOf('maria'), 'gerald', 'platinum')).toBe('gold')
  })

  it('takes the discount, then the credit, and always leaves something to pay', () => {
    const number = loyaltyNumberOf('gerald')
    expect(applyPerks(300_000, { number, tier: 'platinum', useCredit: false }, 0)).toEqual({ discount: 15_000, credit: 0, total: 285_000 })
    expect(applyPerks(300_000, { number: 'CC1234567', tier: 'platinum', useCredit: false }, 0).discount).toBe(0)
    expect(applyPerks(300_000, { number, tier: 'gold', useCredit: true }, 25_000)).toEqual({ discount: 6000, credit: 25_000, total: 269_000 })
    const small = applyPerks(30_000, { number: '', tier: 'none', useCredit: true }, 25_000)
    expect(small.total).toBe(MIN_PAID)
    expect(small.credit).toBe(20_000)
    expect(applyPerks(300_000, { number: '', tier: 'none', useCredit: true }, 0).credit).toBe(0)
  })
})

describe('upgrade bids (MNG-06)', () => {
  const offers = upgradeOffers('balcony', (c) => ({ miniSuite: 70_000, sanctuaryMiniSuite: 200_000 } as Record<string, number>)[c] ?? null)

  it('offers up to two higher room types with a floor and a fixed price', () => {
    expect(offers.map((o) => o.category)).toEqual(['miniSuite', 'sanctuaryMiniSuite'])
    expect(offers[0]).toMatchObject({ difference: 70_000, minBid: 28_000, buyNow: 63_000 })
    expect(upgradeOffers('signatureSuite', () => 5)).toEqual([])
  })

  it('checks a bid', () => {
    expect(bidProblem(offers[0], 40_000)).toBeNull()
    expect(bidProblem(offers[0], 10_000)).toBe('tooLow')
    expect(bidProblem(offers[0], 90_000)).toBe('tooHigh')
    expect(bidProblem(offers[0], 40_050)).toBe('notWhole')
    expect(bidProblem(undefined, 40_000)).toBe('badCategory')
  })

  it('always accepts the fixed price, rejects the floor, and answers the same each time', () => {
    expect(bidWins(offers[0], 63_000, 'k')).toBe(true)
    expect(bidWins(offers[0], 28_000, 'k')).toBe(false)
    expect(bidWins(offers[0], 50_000, 'k')).toBe(bidWins(offers[0], 50_000, 'k'))
  })
})

describe('kids’ clubs (PRE-08)', () => {
  const ok = { ...blankRegistration('ethan'), emergencyPhone: '305-555-0100', pickups: [{ name: 'Daniel Harper', relation: 'Father', phone: '305-555-0100' }], confirmed: true }

  it('places a child in the club for their age', () => {
    expect(clubForAge(2)).toBeUndefined()
    expect(clubForAge(3)?.id).toBe('firefly')
    expect(clubForAge(9)?.id).toBe('neon')
    expect(clubForAge(17)?.id).toBe('underground')
    expect(clubForAge(18)).toBeUndefined()
    expect(CLUBS.map((c) => c.minAge)).toEqual([3, 8, 13])
  })

  it('needs a number, an adult to collect, and a tick', () => {
    expect(clubProblem(ok, 9)).toBeNull()
    expect(clubProblem(ok, 20)).toBe('noClub')
    expect(clubProblem({ ...ok, emergencyPhone: '1' }, 9)).toBe('noEmergency')
    expect(clubProblem({ ...ok, pickups: [] }, 9)).toBe('noPickup')
    expect(clubProblem({ ...ok, confirmed: false }, 9)).toBe('confirm')
    expect(clubProblem({ ...ok, pickups: [{ name: 'X', relation: 'Aunt', phone: '305-555-0100' }] }, 9)).toBe('badPickup')
    expect(clubProblem({ ...ok, allergies: 'x'.repeat(301) }, 9)).toBe('tooLong')
  })

  it('lets only a teen sign themselves out', () => {
    expect(clubProblem({ ...ok, pickups: [], selfSignOut: true }, 14)).toBeNull()
    expect(clubProblem({ ...ok, selfSignOut: true }, 10)).toBe('selfSignOut')
  })
})

describe('medallion (CHK-06)', () => {
  const departure = 100 * DAY
  const booked = departure - 90 * DAY

  it('moves from made, to posted, to delivered', () => {
    expect(medallionStatus(departure, booked, booked + DAY, null, null).stage).toBe('preparing')
    expect(medallionStatus(departure, booked, departure - 10 * DAY, null, null).stage).toBe('shipped')
    const arrived = medallionStatus(departure, booked, departure - 5 * DAY, null, null)
    expect(arrived.stage).toBe('delivered')
    expect(arrived.canActivate).toBe(true)
    expect(arrived.events.map((e) => e.id)).toEqual(['ordered', 'shipped', 'delivered'])
  })

  it('is collected at the terminal when booked too late, and cannot be switched on twice or after a loss', () => {
    expect(medallionStatus(departure, departure - 5 * DAY, departure - DAY, null, null)).toMatchObject({ stage: 'collect', canActivate: false })
    expect(medallionStatus(departure, booked, departure - 5 * DAY, 5, null).canActivate).toBe(false)
    expect(medallionStatus(departure, booked, departure - 5 * DAY, null, 5)).toMatchObject({ canActivate: false, replacement: true })
  })
})

describe('luggage tags (CHK-09)', () => {
  it('estimates where a bag is from when it was handed over', () => {
    expect(bagStage(null, 99)).toBe('atHome')
    expect(bagStage(0, 10 * 60_000)).toBe('handedOver')
    expect(bagStage(0, 2 * HOUR)).toBe('onShip')
    expect(bagStage(0, 4 * HOUR)).toBe('inCorridor')
    expect(bagStage(0, 6 * HOUR)).toBe('delivered')
  })

  it('only posts a set in time', () => {
    expect(tagProblem('order', 30)).toBeNull()
    expect(tagProblem('order', 5)).toBe('tooLate')
    expect(tagProblem('print', 1)).toBeNull()
    expect(tagProblem('fax', 30)).toBe('badWay')
  })
})

describe('extra support (SUP-07)', () => {
  it('moves through stages with time', () => {
    expect(assistStage(0, HOUR)).toBe('received')
    expect(assistStage(0, 5 * HOUR)).toBe('reviewing')
    expect(assistStage(0, 49 * HOUR)).toBe('decided')
  })

  it('checks a request, and waives the fee with a choice of refund or credit', () => {
    expect(assistProblem('bereavement', '305-555-0100', 'My mother died', true)).toBeNull()
    expect(assistProblem('nope', '305-555-0100', 'My mother died', true)).toBe('badKind')
    expect(assistProblem('medical', '1', 'My mother died', true)).toBe('badPhone')
    expect(assistProblem('medical', '305-555-0100', 'no', true)).toBe('noNote')
    expect(assistProblem('medical', '305-555-0100', 'Surgery planned', false)).toBe('noBooking')
    expect(assistProblem('assistedBooking', '305-555-0100', 'Please call me', false)).toBeNull()
    expect(compassionTerms(100_000)).toEqual({ fee: 0, refund: 100_000, credit: 110_000 })
  })
})

describe('gifts (PRE-07, MNG-13)', () => {
  it('only suggests gifts that exist', () => {
    for (const ids of Object.values(GIFTS_FOR)) for (const id of ids) expect(itemById(id)?.group, id).toBe('gift')
    expect(GIFTS_FOR.none).toEqual([])
  })
})

describe('port entry rules (CHK-10)', () => {
  it('covers every stop with something for each kind of passport', () => {
    expect(CLEARANCE.map((c) => c.port)).toEqual(['fll', 'cozumel', 'belize', 'roatan'])
    for (const c of CLEARANCE) {
      expect(c.documents.us.length, c.port).toBeGreaterThan(20)
      expect(c.documents.other.length, c.port).toBeGreaterThan(20)
      expect(c.forms.length, c.port).toBeGreaterThan(0)
    }
    expect(clearanceFor('sea')).toBeUndefined()
    expect(clearanceFor('belize')?.country).toBe('Belize')
  })
})

describe('weather outlook (MNG-09) and units (ACT-08)', () => {
  it('has twelve months for every port, with sane values', () => {
    for (const rows of Object.values(CLIMATE)) {
      expect(rows).toHaveLength(12)
      for (const r of rows) { expect(r.highF).toBeGreaterThan(r.lowF); expect(r.uv).toBeGreaterThan(0) }
    }
  })

  it('finds the month from the date and flags hurricane season', () => {
    expect(outlook('cozumel', '2027-03-23')).toMatchObject({ month: 2, hurricane: false, highF: 85 })
    expect(outlook('roatan', '2026-10-05').hurricane).toBe(true)
    expect(isHurricaneSeason('2027-01-17')).toBe(false)
    expect(uvBand(5)).toBe('moderate')
    expect(uvBand(8)).toBe('veryHigh')
    expect(uvBand(11)).toBe('extreme')
  })

  it('converts temperatures', () => {
    expect(toCelsius(32)).toBe(0)
    expect(toCelsius(86)).toBe(30)
    expect(formatTemp(86, 'imperial')).toBe('86°F')
    expect(formatTemp(86, 'metric')).toBe('30°C')
  })
})

describe('health and comfort preparation (MNG-19)', () => {
  it('lists what is left, soonest first, and marks late ones', () => {
    const due = prepDue([], '2027-03-21', '2027-03-10', addDays)
    expect(due).toHaveLength(PREP.length)
    for (let i = 1; i < due.length; i++) expect(due[i - 1].start <= due[i].start).toBe(true)
    expect(due.find((d) => d.item.id === 'ins-buy')?.late).toBe(true)
    expect(prepDue(PREP.map((p) => p.id), '2027-03-21', '2027-03-10', addDays)).toEqual([])
  })
})

describe('fix-it flows (MNG-18)', () => {
  it('has the three flows, each with steps and unique ids', () => {
    expect(FIX_FLOWS.map((f) => f.id)).toEqual(['noBooking', 'nameMismatch', 'lostDocs'])
    for (const f of FIX_FLOWS) {
      expect(f.steps.length).toBeGreaterThan(2)
      expect(new Set(f.steps.map((s) => s.id)).size).toBe(f.steps.length)
    }
  })
})

describe('health and children’s data rules (SEC-07, SEC-08)', () => {
  it('are complete, and every health record has a deletion date', () => {
    expect(dataRuleProblems()).toEqual([])
    expect(DATA_RULES.some((r) => r.sensitivity === 'health')).toBe(true)
    expect(DATA_RULES.some((r) => r.sensitivity === 'minor')).toBe(true)
  })
})
