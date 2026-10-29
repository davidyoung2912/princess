import { describe, expect, it } from 'vitest'
import { ASSIST_KINDS, deadline, requestStatus, assistKind } from './assistance'
import { buildChecklist, milestones, nextItem, progress, CHECKLIST, type AutoKey } from './checklist'
import { diningWindow, mealCharge, slotsFor, tableClash, venueById, VENUES, DINNER_TIMES, planOf } from './dining'
import { computeEntitlements } from './entitlements'
import { backBy, conflictingGuests, EXCURSIONS, excursionById, filterExcursions, guestPrice, NO_FILTER, overlaps, spotsLeft, timingProblem, tourRefund, endMinutes } from './excursions'
import { ADD_ONS, addOnPrice, breakEvenDrinks, drinksWorth, packageWorth, priceState, unitPrice, upgradeBase, upgradesFrom, upgradePrice, DEFAULT_USAGE, bestPackage, units } from './packages'
import { buildPackingList, elegantNights, packingText, weatherFor } from './packing'
import { buildPlan, countBooked } from './plan'
import { REFERENCE_SAILING, itinerary } from './sailings'
import { PORT_GUIDES } from './ports'
import { arrivalWindows, normalizePlan, HOTELS } from './travel'

const day = (n: number) => itinerary(REFERENCE_SAILING)[n - 1]

describe('excursions', () => {
  it('agrees with the port guides on names, lengths and prices', () => {
    for (const guide of Object.values(PORT_GUIDES)) {
      for (const e of guide.excursions) {
        const x = excursionById(e.id)!
        expect(x.port, e.id).toBe(guide.id)
        expect(x.name).toBe(e.name)
        expect(x.hours).toBe(e.hours)
        expect(x.price).toBe(e.price * 100)
        expect(x.activity === 'easy' ? 'easy' : x.activity === 'moderate' ? 'some' : 'demanding').toBe(e.access)
      }
    }
  })

  it('fits every tour to the ship’s day, with a longer buffer at the tender port', () => {
    for (const x of EXCURSIONS) {
      const d = itinerary(REFERENCE_SAILING).find((i) => i.port === x.port)!
      expect(timingProblem(x, d), x.id).toBeNull()
    }
    expect(backBy(excursionById('coz-snorkel')!, day(3))).toBe('15:45')
    expect(backBy(excursionById('bze-cave')!, day(4))).toBe('14:30')
  })

  it('refuses a tour that starts before guests can be ashore or ends too late to get back', () => {
    const early = { ...excursionById('bze-altunha')!, start: '07:30' }
    const late = { ...excursionById('coz-beach')!, start: '11:00' }
    expect(timingProblem(early, day(4))).toBe('tooEarly')
    expect(timingProblem(late, day(3))).toBe('tooLate')
    expect(endMinutes(late)).toBe(17 * 60)
  })

  it('filters by port, interest, level, price, family and wheelchair access', () => {
    const ids = (f: Partial<typeof NO_FILTER>) => filterExcursions(EXCURSIONS, { ...NO_FILTER, ...f }).map((x) => x.id)
    expect(ids({ port: 'belize' })).toHaveLength(4)
    expect(ids({ interests: ['adventure'] }).sort()).toEqual(['bze-cave', 'rtb-zip'])
    expect(ids({ maxActivity: 'easy' }).every((id) => excursionById(id)!.activity === 'easy')).toBe(true)
    expect(ids({ maxPrice: 60 }).every((id) => excursionById(id)!.price <= 6000)).toBe(true)
    expect(ids({ family: true })).not.toContain('bze-cave')
    expect(ids({ accessible: true }).every((id) => excursionById(id)!.wheelchair)).toBe(true)
    expect(ids({ port: 'cozumel', accessible: true, maxPrice: 50 })).toEqual(['coz-glass'])
  })

  it('charges children under 12 less and keeps the count of places honest', () => {
    const x = excursionById('coz-ruins')!
    expect(guestPrice(x, 40)).toBe(6900)
    expect(guestPrice(x, 8)).toBe(4800)
    expect(spotsLeft(excursionById('rtb-zip')!, 'sun-2027-03-21')).toBe(0)
    expect(spotsLeft(x, 'sun-2027-03-21')).toBeGreaterThanOrEqual(5)
    expect(spotsLeft(x, 'sun-2027-03-21')).toBe(spotsLeft(x, 'sun-2027-03-21'))
    expect(spotsLeft(x, 'sun-2027-03-21', 3)).toBe(spotsLeft(x, 'sun-2027-03-21') - 3)
  })

  it('finds guests who would be on two tours at once', () => {
    const snorkel = excursionById('coz-snorkel')!
    const ruins = excursionById('coz-ruins')!
    const glass = excursionById('coz-glass')!
    expect(overlaps(snorkel, ruins)).toBe(true)
    expect(overlaps(snorkel, glass)).toBe(false)
    expect(overlaps(snorkel, excursionById('bze-reef')!)).toBe(false)
    expect(conflictingGuests([{ excursionId: 'coz-ruins', guests: ['a', 'b'] }], snorkel, ['b', 'c'])).toEqual(['b'])
    expect(conflictingGuests([{ excursionId: 'coz-snorkel', guests: ['a'] }], snorkel, ['a'])).toEqual([])
    expect(conflictingGuests([{ excursionId: 'coz-glass', guests: ['a'] }], snorkel, ['a'])).toEqual([])
  })

  it('refunds in full until two days before the port day', () => {
    expect(tourRefund(7900, 10)).toEqual({ fee: 0, refund: 7900, free: true })
    expect(tourRefund(7900, 2).free).toBe(true)
    expect(tourRefund(7900, 1)).toEqual({ fee: 7900, refund: 0, free: false })
  })
})

describe('dining', () => {
  it('opens reservations at booking for Platinum and Elite, and after full payment for everyone else (DIN-12)', () => {
    const gold = computeEntitlements({ tier: 'gold', package: 'none', sanctuary: false })
    const platinum = computeEntitlements({ tier: 'platinum', package: 'none', sanctuary: false })
    expect(diningWindow(platinum, 'upcoming', '2027-02-19')).toEqual({ open: true })
    expect(diningWindow(gold, 'paid', '2027-02-19')).toEqual({ open: true })
    expect(diningWindow(gold, 'dueSoon', '2027-02-19')).toEqual({ open: false, reason: 'awaitingPayment', opensOn: '2027-02-19' })
  })

  it('gives Anytime Dining guests no assigned time and Gerald a fixed seating', () => {
    expect(planOf('gerald')).toBe('early')
    expect(planOf('maria')).toBe('anytime')
  })

  it('makes the same grid for the same night, with the peak times filling first', () => {
    const a = slotsFor('crown', 'sun-2027-03-21', 3)
    expect(a).toEqual(slotsFor('crown', 'sun-2027-03-21', 3))
    expect(a.map((s) => s.time)).toEqual([...DINNER_TIMES])
    const nights = [1, 2, 3, 4, 5, 6, 7]
    const full = (time: string) => nights.flatMap((n) => ['crown', 'sabatini', 'catch', 'love'].map((v) => slotsFor(v, 'sun-2027-03-21', n).find((s) => s.time === time)!)).filter((s) => s.tables === 0).length
    expect(full('19:00') + full('19:30')).toBeGreaterThan(full('17:30') + full('18:00'))
    expect(a.some((s) => s.tables > 0)).toBe(true)
  })

  it('covers specialty dinners with the package while meals last, and charges the rest', () => {
    const crown = venueById('crown')!
    expect(mealCharge(crown, 4, 2)).toEqual({ covered: 2, pays: 2, charge: 9000 })
    expect(mealCharge(crown, 2, 0)).toEqual({ covered: 0, pays: 2, charge: 9000 })
    expect(mealCharge(venueById('eclipse')!, 4, 3).charge).toBe(0)
    expect(VENUES.filter((v) => v.walkIn).map((v) => v.id)).toEqual(['alfredo'])
  })

  it('stops one person being at two tables within a sitting', () => {
    const held = [{ venueId: 'crown', day: 3, time: '19:00', guests: ['a', 'b'] }]
    expect(tableClash(held, 3, '20:00', ['b', 'c'])).toEqual(['b'])
    expect(tableClash(held, 3, '21:00', ['b'])).toEqual([])
    expect(tableClash(held, 4, '19:00', ['b'])).toEqual([])
  })
})

describe('packages and price protection', () => {
  it('prices the move up to Plus or Premier net of the gratuities already paid', () => {
    expect(upgradeBase('none', 'plus')).toBe((6000 - 1650) * 7)
    expect(upgradeBase('plus', 'premier')).toBe(3000 * 7)
    expect(upgradesFrom('none').map((u) => u.to)).toEqual(['plus', 'premier'])
    expect(upgradesFrom('plus').map((u) => u.to)).toEqual(['premier'])
    expect(upgradesFrom('premier')).toEqual([])
    expect(bestPackage('plus', 'none')).toBe('plus')
    expect(bestPackage('plus', 'premier')).toBe('premier')
  })

  it('holds the price until the change date, then moves it', () => {
    expect(addOnPrice('drinks', 20)).toBe(5200)
    expect(addOnPrice('drinks', 15)).toBe(5200)
    expect(addOnPrice('drinks', 14)).toBe(5900)
    expect(addOnPrice('photo', 10)).toBe(14900)
    expect(addOnPrice('photo', 9)).toBe(11900)
    expect(addOnPrice('laundry', 0)).toBe(9900)
    const u = upgradesFrom('none')[0]
    expect(upgradePrice(u, 15)).toBe(u.base)
    expect(upgradePrice(u, 14)).toBeGreaterThan(u.base)
    expect(unitPrice(1000, { atDays: 5, share: 0.5 }, 4)).toBe(1500)
  })

  it('says locked after a rise, dropped after a fall', () => {
    expect(priceState(5200, 5900)).toEqual({ state: 'locked', perUnit: 700 })
    expect(priceState(14900, 11900)).toEqual({ state: 'dropped', perUnit: 3000 })
    expect(priceState(100, 100)).toEqual({ state: 'same', perUnit: 0 })
  })

  it('counts units by person, night or room', () => {
    expect(units('personNight', 2)).toBe(14)
    expect(units('person', 3)).toBe(3)
    expect(units('room', 4)).toBe(1)
    expect(ADD_ONS.drinks.minAge).toBe(21)
  })

  it('works out whether the drinks package pays for itself', () => {
    expect(breakEvenDrinks(5900)).toBe(4.6)
    expect(drinksWorth(5900, { drinksPerDay: 6, avgDrink: 1100 }).worthIt).toBe(true)
    expect(drinksWorth(5900, { drinksPerDay: 2, avgDrink: 1100 })).toMatchObject({ worthIt: false })
    expect(drinksWorth(5900, { drinksPerDay: 2, avgDrink: 1100 }).savings).toBeLessThan(0)
  })

  it('compares a package upgrade with paying for the same things', () => {
    const heavy = packageWorth('none', 'plus', 30450, { ...DEFAULT_USAGE, drinksPerDay: 5 })
    const light = packageWorth('none', 'plus', 30450, { drinksPerDay: 0, specialtyDinners: 0, wifi: false, excursionSpend: 0, avgDrink: 1100 })
    expect(heavy.worthIt).toBe(true)
    expect(light).toMatchObject({ without: 0, worthIt: false })
    expect(packageWorth('plus', 'premier', 21000, { ...DEFAULT_USAGE, excursionSpend: 0, specialtyDinners: 0 }).without).toBeLessThan(packageWorth('plus', 'premier', 21000, DEFAULT_USAGE).without)
  })
})

describe('checklist', () => {
  const base = { departure: '2027-03-21', today: '2027-03-07', daysToDeparture: 14 }
  const none: Record<AutoKey, boolean> = { paid: false, documents: false, tours: false, dining: false, assistance: false, travel: false, checkin: false }

  it('puts every item on a 90, 60, 30, 14, 7 or 1-day milestone', () => {
    expect(new Set(CHECKLIST.map((i) => i.daysBefore))).toEqual(new Set([90, 60, 30, 14, 7, 1]))
    const entries = buildChecklist({ ...base, auto: none, ticked: [] })
    expect(milestones(entries).map((m) => m.daysBefore)).toEqual([90, 60, 30, 14, 7, 1])
    expect(milestones(entries)[0].due).toBe('2026-12-21')
  })

  it('marks what the app can see as done, and what is late as overdue', () => {
    const entries = buildChecklist({ ...base, auto: { ...none, paid: true, travel: true }, ticked: ['names'] })
    const state = (id: string) => entries.find((e) => e.id === id)!.state
    expect(state('pay')).toBe('done')
    expect(entries.find((e) => e.id === 'pay')!.automatic).toBe(true)
    expect(state('names')).toBe('done')
    expect(entries.find((e) => e.id === 'names')!.automatic).toBe(false)
    expect(state('documents')).toBe('overdue')
    expect(state('travel')).toBe('done')
    expect(state('packages')).toBe('dueSoon')
    expect(state('checkin')).toBe('dueSoon')
    expect(state('bags')).toBe('upcoming')
    expect(progress(entries)).toEqual({ done: 3, total: CHECKLIST.length })
  })

  it('suggests the overdue item first, then the soonest', () => {
    const entries = buildChecklist({ ...base, auto: none, ticked: [] })
    expect(['pay', 'names', 'documents', 'tours', 'assistance', 'dining', 'insurance']).toContain(nextItem(entries)!.id)
    expect(nextItem(entries)!.state).toBe('overdue')
    const allDone = buildChecklist({ ...base, auto: { paid: true, documents: true, tours: true, dining: true, assistance: true, travel: true, checkin: true }, ticked: CHECKLIST.filter((i) => !i.auto).map((i) => i.id) })
    expect(nextItem(allDone)).toBeNull()
  })
})

describe('packing list', () => {
  const input = { departure: '2027-03-21', nights: 7, tours: [] as string[], ages: [40, 38], needs: [] as never[], tender: true, elegantNights: 2 }
  const ids = (over = {}) => buildPackingList({ ...input, ...over }).map((i) => i.id)

  it('always has documents, clothes and a tender-port bag', () => {
    expect(ids()).toEqual(expect.arrayContaining(['passport', 'daywear', 'elegant', 'tenderBag', 'meds']))
    expect(ids({ tender: false })).not.toContain('tenderBag')
  })

  it('adds what the booked tours, the party and health needs call for', () => {
    expect(ids()).not.toContain('waterShoes')
    expect(ids({ tours: ['coz-snorkel'] })).toContain('waterShoes')
    expect(ids({ tours: ['rtb-zip'] })).toContain('closedShoes')
    expect(ids({ tours: ['coz-ruins'] })).toContain('ruinsShoes')
    expect(ids({ ages: [40, 2] })).toEqual(expect.arrayContaining(['swimDiapers', 'games']))
    expect(ids({ ages: [40, 15] })).toContain('teenClothes')
    expect(ids({ needs: ['cpap'] })).toContain('cpap')
    expect(ids({ departure: '2026-11-08' })).toContain('rain')
    expect(ids()).not.toContain('rain')
  })

  it('has unique ids, a reason for each item, and shareable text with ticks', () => {
    const list = buildPackingList(input)
    expect(new Set(list.map((i) => i.id)).size).toBe(list.length)
    expect(list.every((i) => i.why.length > 0)).toBe(true)
    const text = packingText('Packing', list, ['passport'])
    expect(text).toContain('[x] Passports for everyone')
    expect(text).toContain('[ ] Two swimsuits')
    expect(elegantNights(7)).toBe(2)
    expect(elegantNights(4)).toBe(0)
    expect(weatherFor('2027-03-21').rain).toBe('low')
  })
})

describe('travel to the port', () => {
  it('gives priority guests an earlier window', () => {
    expect(arrivalWindows(false)[0].start).toBe('11:00')
    expect(arrivalWindows(true)[0].start).toBe('10:30')
  })
  it('keeps only valid choices', () => {
    expect(normalizePlan({ window: '10:30', mode: 'drive', hotel: 'seabreeze' }, false)).toEqual({ window: null, mode: 'drive', hotel: 'seabreeze' })
    expect(normalizePlan({ window: '10:30', mode: 'drive', hotel: 'seabreeze' }, true).window).toBe('10:30')
    expect(normalizePlan('junk', false)).toEqual({ window: null, mode: null, hotel: null })
    expect(HOTELS.length).toBeGreaterThan(1)
  })
})

describe('assistance deadlines', () => {
  const departure = '2027-03-21'
  it('counts down to the cut-off for each kind of request', () => {
    expect(deadline(assistKind('wheelchair')!, departure, '2027-03-07')).toEqual({ by: '2027-02-19', daysLeft: -16, state: 'late' })
    expect(deadline(assistKind('cpap')!, departure, '2027-03-01')).toMatchObject({ by: '2027-03-07', daysLeft: 6, state: 'soon' })
    expect(deadline(assistKind('tender')!, departure, '2027-02-01')).toMatchObject({ by: '2027-03-14', state: 'open' })
    expect(ASSIST_KINDS.every((k) => k.noticeDays > 0)).toBe(true)
  })
  it('confirms a day later, and marks a late request as unguaranteed', () => {
    const k = assistKind('cpap')!
    const at = Date.UTC(2027, 1, 1, 12)
    expect(requestStatus(k, departure, '2027-02-01', at, at + 3_600_000)).toBe('received')
    expect(requestStatus(k, departure, '2027-02-01', at, at + 25 * 3_600_000)).toBe('confirmed')
    expect(requestStatus(k, departure, '2027-03-15', at, at + 99 * 3_600_000)).toBe('late')
  })
})

describe('the plan', () => {
  it('lays tours and dinners on the right days, and shows what is missing', () => {
    const plan = buildPlan(
      REFERENCE_SAILING,
      [{ id: 't1', excursionId: 'coz-snorkel', guests: ['a'] }],
      [{ id: 'r1', venueId: 'crown', day: 3, time: '19:00', guests: ['a'] }],
    )
    expect(plan).toHaveLength(8)
    const cozumel = plan[2]
    expect(cozumel.entries.map((e) => e.kind)).toEqual(['tour', 'allAboard', 'dinner'])
    expect(cozumel.gaps).toEqual([])
    expect(plan[3].gaps).toEqual(['tour', 'dinner'])
    expect(plan[1].gaps).toEqual(['dinner'])
    expect(plan[7].gaps).toEqual([])
    expect(plan[0].entries[0].kind).toBe('sail')
    expect(countBooked(plan)).toBe(2)
  })
})
