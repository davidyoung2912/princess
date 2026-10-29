import { describe, expect, it } from 'vitest'
import { checkInProblem, clubFor, defaultZones, kidStatus, lastSeen, normalizeAuth, normalizeReunion, CLUBS } from './family'
import { isolating, medicalOpen, nextOpening, reportProblem } from './health'
import { canCancel, breakfastMornings, itemById, orderFolioLines, orderProblem, orderProgress, priceOrder, MENU, menuFor, type GuestInfo, type OrderLine } from './orders'
import { checksum, cheapest, filterPhotos, NO_PHOTO_FILTER, photoOptions, photosFor } from './photos'
import { laundryPrice, laundryStage, pickupOptions, serviceById } from './laundry'
import { devicesProblem, dndCheckDue, normalizeDevices, normalizeHousekeeping } from './room'
import { addProblem, upgradeCost, planById, usedTodayMb } from './wifi'
import { REFERENCE_SAILING } from './sailings'
import { zonedToEpoch } from './timezones'

const adult: GuestInfo = { id: 'daniel', age: 41, drinkCapUsd: 15 }
const teen: GuestInfo = { id: 'ethan', age: 14, drinkCapUsd: 0 }
const line = (itemId: string, over: Partial<OrderLine> = {}): OrderLine => ({ itemId, qty: 1, extras: [], guest: 'daniel', ...over })
const MIN = 60_000

describe('order menu and pricing', () => {
  it('keeps breakfast off the delivery menu and the delivery-only items off room service', () => {
    expect(menuFor('delivery').some((m) => m.group === 'breakfast')).toBe(false)
    expect(menuFor('breakfast').every((m) => m.group === 'breakfast')).toBe(true)
    expect(menuFor('room').some((m) => m.id === 'fish-tacos')).toBe(false)
    expect(menuFor('room').some((m) => m.id === 'club-sandwich')).toBe(true)
  })

  it('names a substitute for everything that can run out', () => {
    for (const id of ['fish-tacos', 'lava-cake', 'cheeseburger']) expect(itemById(itemById(id)!.substitute)).toBeDefined()
    expect(MENU.every((m) => !m.substitute || !!itemById(m.substitute))).toBe(true)
  })

  it('refuses a bad order with a code for the reason', () => {
    const base = { kind: 'delivery' as const, location: { kind: 'cabin' as const }, tip: 0 }
    const guests = [adult, teen]
    expect(orderProblem({ ...base, lines: [] }, guests)).toBe('empty')
    expect(orderProblem({ ...base, lines: [line('nope')] }, guests)).toBe('unknownItem')
    expect(orderProblem({ ...base, lines: [line('club-sandwich')] }, guests)).toBe('wrongMenu')
    expect(orderProblem({ ...base, lines: [line('fries', { qty: 0 })] }, guests)).toBe('badQuantity')
    expect(orderProblem({ ...base, lines: [line('cheeseburger', { extras: ['truffle'] })] }, guests)).toBe('unknownExtra')
    expect(orderProblem({ ...base, lines: [line('beer', { guest: 'ethan' })] }, guests)).toBe('underage')
    expect(orderProblem({ ...base, lines: [line('fries', { guest: 'gerald' })] }, guests)).toBe('noGuest')
    expect(orderProblem({ ...base, tip: 123, lines: [line('fries')] }, guests)).toBe('badTip')
    expect(orderProblem({ ...base, location: { kind: 'zone', placeId: 'casino' }, lines: [line('fries')] }, guests)).toBe('badLocation')
    expect(orderProblem({ ...base, location: { kind: 'other', text: 'x' }, lines: [line('fries')] }, guests)).toBe('badLocation')
    expect(orderProblem({ ...base, lines: [line('fish-tacos')] }, guests, ['fish-tacos'])).toBe('unavailable')
    expect(orderProblem({ ...base, lines: [line('fries')] }, guests)).toBeNull()
    expect(orderProblem({ kind: 'breakfast', location: { kind: 'cabin' }, tip: 0, lines: [line('continental')] }, guests)).toBe('noTime')
  })

  it('adds extras, charges delivery away from the stateroom, and adds the bar service charge only on alcohol', () => {
    const p = priceOrder([line('cheeseburger', { extras: ['bacon'], qty: 2 })], { kind: 'delivery', location: { kind: 'zone', placeId: 'lido-pool' }, tip: 200, guests: [adult], free: false })
    expect(p.lines[0].gross).toBe((950 + 250) * 2)
    expect(p.fee).toBe(200)
    expect(p.service).toBe(0)
    expect(p.total).toBe(2400 + 200 + 200)
    const cabin = priceOrder([line('cheeseburger')], { kind: 'delivery', location: { kind: 'cabin' }, tip: 0, guests: [{ ...adult, drinkCapUsd: 0 }], free: false })
    expect(cabin.fee).toBe(0)
    const bar = priceOrder([line('beer', { qty: 2 })], { kind: 'room', location: { kind: 'cabin' }, tip: 0, guests: [{ ...adult, drinkCapUsd: 0 }], free: false })
    expect(bar.service).toBe(Math.round(1600 * 0.18))
  })

  it('has a drinks package pay up to its cap per drink and the guest pay the difference', () => {
    const p = priceOrder([line('premium-cocktail', { qty: 2 }), line('mai-tai')], { kind: 'room', location: { kind: 'cabin' }, tip: 0, guests: [adult], free: false })
    expect(p.lines[0]).toMatchObject({ gross: 4400, charge: 2 * 700, coveredBy: 'package' })
    expect(p.lines[1]).toMatchObject({ charge: 0, coveredBy: 'package' })
    expect(p.covered).toBe(4400 - 1400 + 1300)
    expect(p.service).toBe(Math.round((4400 + 1300) * 0.18))
  })

  it('makes meals and delivery free while isolating, but not alcohol', () => {
    const p = priceOrder([line('cheeseburger'), line('beer')], { kind: 'delivery', location: { kind: 'zone', placeId: 'lido-pool' }, tip: 0, guests: [{ ...adult, drinkCapUsd: 0 }], free: true })
    expect(p.lines[0]).toMatchObject({ charge: 0, coveredBy: 'fare' })
    expect(p.lines[1].charge).toBe(800)
    expect(p.fee).toBe(0)
  })

  it('swaps a line for its substitute or removes it, and drops the tip and fee when nothing is left', () => {
    const lines = [line('lava-cake'), line('fries')]
    const opts = { kind: 'delivery' as const, location: { kind: 'zone' as const, placeId: 'dome' }, tip: 200, guests: [adult], free: false }
    const sub = priceOrder(lines, { ...opts, choices: { 0: 'substitute' } })
    expect(sub.lines[0]).toMatchObject({ name: 'Seasonal fruit plate', substitutedFor: 'lava-cake', charge: 600 })
    const gone = priceOrder(lines, { ...opts, choices: { 0: 'remove', 1: 'remove' } })
    expect(gone).toMatchObject({ total: 0, fee: 0, tip: 0 })
  })
})

describe('order progress', () => {
  const start = Date.UTC(2027, 2, 22, 18)
  const o = { kind: 'delivery' as const, placedAt: start, pending: false }
  it('moves received, preparing, on the way, delivered with an ETA', () => {
    expect(orderProgress(o, start + 2 * MIN)).toMatchObject({ stage: 'received', etaAt: start + 30 * MIN })
    expect(orderProgress(o, start + 10 * MIN).stage).toBe('preparing')
    expect(orderProgress(o, start + 22 * MIN).stage).toBe('onTheWay')
    expect(orderProgress(o, start + 31 * MIN).stage).toBe('delivered')
  })
  it('stops the clock when something ran out and carries on from the choice', () => {
    const p = { ...o, pending: true }
    expect(orderProgress(p, start + 4 * MIN).stage).toBe('received')
    expect(orderProgress(p, start + 40 * MIN)).toMatchObject({ stage: 'needsChoice', etaAt: null })
    const done = { ...o, resolvedAt: start + 15 * MIN }
    expect(orderProgress(done, start + 16 * MIN).stage).toBe('preparing')
    expect(orderProgress(done, start + 15 * MIN + 29 * MIN).stage).toBe('delivered')
    expect(orderProgress(done, start + 15 * MIN).etaAt).toBe(start + 10 * MIN + 30 * MIN)
  })
  it('lets a guest cancel until cooking starts, or when waiting on their choice', () => {
    expect(canCancel(orderProgress(o, start + 1 * MIN).stage)).toBe(true)
    expect(canCancel(orderProgress(o, start + 8 * MIN).stage)).toBe(false)
    expect(canCancel(orderProgress({ ...o, pending: true }, start + 20 * MIN).stage)).toBe(true)
    expect(orderProgress({ ...o, cancelledAt: start + 1 }, start + 20 * MIN).stage).toBe('cancelled')
  })
  it('holds a scheduled breakfast until its start', () => {
    const deliverAt = start + 600 * MIN
    const b = { kind: 'breakfast' as const, placedAt: start, deliverAt, pending: false }
    expect(orderProgress(b, start + 60 * MIN)).toMatchObject({ stage: 'scheduled', etaAt: deliverAt })
    expect(orderProgress(b, deliverAt - 33 * MIN).stage).toBe('received')
    expect(orderProgress(b, deliverAt).stage).toBe('delivered')
  })
  it('offers mornings with two hours’ notice, in ship time', () => {
    const now = zonedToEpoch('2027-03-22', '12:00', 'America/New_York')
    const m = breakfastMornings(REFERENCE_SAILING, now)
    expect(m[0].day).toBe(3)
    expect(m).toHaveLength(3)
    expect(m[0].slots[0].at).toBe(zonedToEpoch('2027-03-23', '06:30', 'America/New_York'))
    const late = breakfastMornings(REFERENCE_SAILING, zonedToEpoch('2027-03-23', '06:45', 'America/New_York'))
    expect(late[0].slots.map((s) => s.time)).toEqual(['09:00', '09:30'])
  })
  it('puts a refund after the charge on a cancelled order', () => {
    const p = priceOrder([line('fries')], { kind: 'room', location: { kind: 'cabin' }, tip: 200, guests: [adult], free: false })
    const lines = orderFolioLines('o1', p, 1000, 3, 2000, 'daniel')
    expect(lines.map((l) => l.cents)).toEqual([500, 200, -700])
    expect(lines.at(-1)).toMatchObject({ category: 'credit', at: 2000 })
  })
})

describe('children’s clubs', () => {
  it('matches clubs by age and checks the time', () => {
    expect(clubFor(2)).toBeUndefined()
    expect(clubFor(3)?.id).toBe('firefly')
    expect(clubFor(8)?.id).toBe('neon-grove')
    expect(clubFor(17)?.id).toBe('underground')
    expect(clubFor(18)).toBeUndefined()
    const neon = CLUBS[1]
    expect(checkInProblem(neon, 7, '10:00', false)).toBe('tooYoung')
    expect(checkInProblem(neon, 13, '10:00', false)).toBe('tooOld')
    expect(checkInProblem(neon, 9, '10:00', true)).toBe('alreadyIn')
    expect(checkInProblem(neon, 9, '08:00', false)).toBe('closed')
    expect(checkInProblem(neon, 9, '22:00', false)).toBe('closed')
    expect(checkInProblem(neon, 9, '09:00', false)).toBeNull()
  })

  it('puts a child at the club once checked in, and flags a place outside the zones or a long silence', () => {
    const now = zonedToEpoch('2027-03-23', '11:00', 'America/New_York')
    const inClub = lastSeen('maya', 8, now, { clubId: 'neon-grove', at: now - 5 * MIN }, false)
    expect(inClub).toMatchObject({ placeId: 'neon-grove', source: 'club' })
    expect(kidStatus(inClub, [], now)).toBe('inClub')
    expect(kidStatus({ placeId: 'casino', at: now - MIN, source: 'band' }, defaultZones(8), now)).toBe('outOfZone')
    expect(kidStatus({ placeId: 'lido-pool', at: now - MIN, source: 'band' }, defaultZones(8), now)).toBe('inZone')
    const missing = lastSeen('lucas', 6, now, null, true)
    expect(kidStatus(missing, defaultZones(6), now)).toBe('overdue')
  })

  it('is steady within a quarter hour and always a real place', () => {
    const now = zonedToEpoch('2027-03-23', '11:00', 'America/New_York')
    const a = lastSeen('maya', 8, now, null, false)
    expect(lastSeen('maya', 8, now + MIN, null, false).placeId).toBe(a.placeId)
    expect(a.at).toBeLessThanOrEqual(now)
    expect(now - a.at).toBeLessThan(15 * MIN)
  })

  it('reads authorisation and meeting plans back safely', () => {
    expect(normalizeAuth(undefined, ['daniel', 'priya'])).toEqual({ pickup: ['daniel', 'priya'], signOutAlone: false, photos: false })
    expect(normalizeAuth({ pickup: ['priya', 'stranger'], signOutAlone: true }, ['daniel', 'priya'])).toEqual({ pickup: ['priya'], signOutAlone: true, photos: false })
    expect(normalizeReunion({ placeId: 'casino', backupId: 'piazza', note: 5 })).toMatchObject({ placeId: 'guest-services', backupId: 'piazza', note: '' })
  })
})

describe('health and room', () => {
  it('knows the Medical Center hours by day type', () => {
    expect(medicalOpen('sea', '09:00')).toBe(true)
    expect(medicalOpen('sea', '13:00')).toBe(false)
    expect(medicalOpen('port', '11:00')).toBe(false)
    expect(nextOpening('sea', '13:00')).toBe('15:00')
    expect(nextOpening('sea', '20:00')).toBeNull()
  })
  it('checks an illness report', () => {
    expect(reportProblem([], ['fever'], 2)).toBe('noGuest')
    expect(reportProblem(['a'], [], 2)).toBe('noSymptoms')
    expect(reportProblem(['a'], ['rash'], 2)).toBe('badSymptom')
    expect(reportProblem(['a'], ['fever'], 200)).toBe('badStart')
    expect(reportProblem(['a'], ['vomiting', 'fever'], 6)).toBeNull()
  })
  it('stays in isolation for 72 hours from a report', () => {
    expect(isolating([1000], 1000 + 71 * 3_600_000)).toBe(true)
    expect(isolating([1000], 1000 + 73 * 3_600_000)).toBe(false)
    expect(isolating([], 5)).toBe(false)
  })
  it('keeps smart-room values in range and only closes shades where there is a view', () => {
    expect(normalizeDevices({ tempF: 99, lights: 'strobe', shades: 'closed' })).toEqual({ lights: 'bright', tempF: 78, tv: false, shades: 'closed' })
    expect(devicesProblem({ tempF: 50 }, true)).toBe('badTemp')
    expect(devicesProblem({ lights: 'off' as never }, true)).toBeNull()
    expect(devicesProblem({ shades: 'closed' }, false)).toBe('noView')
    expect(normalizeHousekeeping({ mode: 'bogus' }).mode).toBe('none')
  })
  it('asks the steward to check after a day of Do Not Disturb', () => {
    const h = { mode: 'dnd' as const, window: 'any' as const, turndown: true, since: 0 }
    expect(dndCheckDue(h, 23 * 3_600_000)).toBe(false)
    expect(dndCheckDue(h, 25 * 3_600_000)).toBe(true)
    expect(dndCheckDue({ ...h, mode: 'makeUp' }, 99 * 3_600_000)).toBe(false)
  })
})

describe('photos, laundry and Wi-Fi', () => {
  const party = ['daniel', 'priya', 'ethan', 'maya'] as const
  it('only shows photos taken so far, with singles at portrait spots', () => {
    expect(photosFor(party, 0)).toHaveLength(0)
    expect(photosFor(party, 1)).toHaveLength(1)
    expect(photosFor(party, 2)).toHaveLength(1 + 1 + 4)
    expect(photosFor(['gerald'], 2)).toHaveLength(2)
    const all = photosFor(party, 8)
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length)
  })
  it('filters by day, place, person and favourite', () => {
    const all = photosFor(party, 8)
    expect(filterPhotos(all, { ...NO_PHOTO_FILTER, day: 2 }, []).every((p) => p.day === 2)).toBe(true)
    expect(filterPhotos(all, { ...NO_PHOTO_FILTER, venue: 'portrait', person: 'maya' }, []).every((p) => p.people.includes('maya'))).toBe(true)
    expect(filterPhotos(all, { ...NO_PHOTO_FILTER, favouritesOnly: true }, [all[0].id])).toEqual([all[0]])
  })
  it('prices the choice before the package, after included photos, and marks the cheapest', () => {
    const three = photoOptions(3, 0)
    expect(three.options.map((o) => o.total)).toEqual([5985, 7995, 14995])
    expect(cheapest(three.options)).toBe('each')
    const nine = photoOptions(9, 0)
    expect(nine.options.map((o) => o.total)).toEqual([17955, 15990, 14995])
    expect(cheapest(nine.options)).toBe('all')
    const covered = photoOptions(5, 12)
    expect(covered).toMatchObject({ included: 5, paid: 0 })
    expect(covered.options.every((o) => o.total === 0)).toBe(true)
    expect(photoOptions(14, 12)).toMatchObject({ included: 12, paid: 2 })
    expect(checksum('a')).toBe(checksum('a'))
    expect(checksum('a')).not.toBe(checksum('b'))
  })
  it('makes the first wash-and-fold bag free with the perk and tracks the request', () => {
    const wash = serviceById('washFold')!
    expect(laundryPrice(wash, 2, true)).toEqual({ total: 1800, free: 1800 })
    expect(laundryPrice(wash, 2, false)).toEqual({ total: 3600, free: 0 })
    expect(laundryPrice(serviceById('press')!, 3, true)).toEqual({ total: 900, free: 0 })
    const r = { pickupAt: 1000, hours: 24 }
    expect(laundryStage(r, 500).stage).toBe('requested')
    expect(laundryStage(r, 1000 + 3_600_000).stage).toBe('cleaning')
    expect(laundryStage(r, 1000 + 25 * 3_600_000).stage).toBe('returned')
    expect(laundryStage({ ...r, cancelledAt: 1 }, 500).stage).toBe('cancelled')
  })
  it('offers only pick-ups that come back before the last morning', () => {
    const now = zonedToEpoch('2027-03-27', '12:00', 'America/New_York')
    const dry = pickupOptions(REFERENCE_SAILING, now, serviceById('dryClean')!)
    expect(dry).toEqual([])
    const press = pickupOptions(REFERENCE_SAILING, now, serviceById('press')!)
    expect(press.every((p) => p.at - now >= 3_600_000)).toBe(true)
  })
  it('checks a Wi-Fi device and prices an upgrade for the days left', () => {
    expect(addProblem('x', 'surf', 1, [])).toBe('badName')
    expect(addProblem('Phone', 'surf', 1, [{ name: 'phone' }])).toBe('duplicate')
    expect(addProblem('Phone', 'fast', 1, [])).toBe('badPlan')
    expect(addProblem('Phone', 'surf', 9, [])).toBe('badDays')
    expect(addProblem('Phone', 'surf', 3, [])).toBeNull()
    expect(addProblem('Tablet', 'surf', 3, Array.from({ length: 6 }, (_, i) => ({ name: `d${i}` })))).toBe('tooMany')
    const dev = { id: 'w', name: 'Phone', plan: 'messaging' as const, addedAt: 0, days: 3, included: false, paid: 2997 }
    expect(upgradeCost(dev, planById('surf')!, 0)).toBe((1999 - 999) * 3)
    expect(upgradeCost(dev, planById('messaging')!, 0)).toBe(0)
    expect(usedTodayMb({ id: 'w', addedAt: 0 }, 0)).toBe(0)
    expect(usedTodayMb({ id: 'w', addedAt: 0 }, 3_600_000)).toBeGreaterThan(0)
  })
})
