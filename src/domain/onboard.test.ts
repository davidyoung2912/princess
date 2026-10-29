import { describe, expect, it } from 'vitest'
import { aboardState, mayTenderInstead, portDayAt, REMINDER_THRESHOLDS, reminderTimes, tenderGroupFor, tenderView, TENDER_GROUPS } from './allaboard'
import { channelById, chatState, ESCALATE_AFTER_MINUTES, replyAt, SLOW_FACTOR } from './chat'
import { DECKS, ELEVATORS, MUSTER_STATIONS, musterByLabel, placeById, PLACES, searchPlaces } from './deck'
import { buildFolio, filterFolio, folioTotals, NO_FOLIO_FILTER, runningTotals, type FolioGuest } from './folio'
import { computeEntitlements } from './entitlements'
import { dishesFor, dishSuits, DIRECTORY, directoryVenue, hoursText, openAt } from './menus'
import { eventsOn, filterEvents, NO_EVENT_FILTER, nowAndNext, overlapping, PLAN_CHANGES, sortEvents } from './program'
import { emergencyCard, isEmergencyCard } from './safety'
import { REFERENCE_SAILING, shipClockChanges } from './sailings'
import { zonedToEpoch } from './timezones'
import { formatTime } from './cruise'

const S = REFERENCE_SAILING

describe('deck plan', () => {
  it('lists every place on a real deck with no duplicate ids', () => {
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length)
    for (const p of PLACES) expect(DECKS).toContain(p.deck)
  })

  it('finds places by name, kind or deck, ignoring accents and apostrophes', () => {
    expect(searchPlaces('sabatinis').map((p) => p.id)).toEqual(['sabatini'])
    expect(searchPlaces('Sabatini’s').map((p) => p.id)).toEqual(['sabatini'])
    expect(searchPlaces('deck 18').every((p) => p.deck === 18)).toBe(true)
    expect(searchPlaces('bar deck 17').map((p) => p.id)).toContain('sea-view')
    expect(searchPlaces('   ')).toEqual([])
    expect(searchPlaces('zzzz')).toEqual([])
  })

  it('has six elevator banks and a muster station for each, matching the letters on the boarding pass', () => {
    expect(ELEVATORS.map((e) => e.bank)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    for (const e of ELEVATORS) expect(MUSTER_STATIONS[e.bank].letter).toBe(e.bank)
    expect(musterByLabel('Station C')?.name).toContain('Piazza')
    expect(musterByLabel('Station Z')).toBeNull()
    for (const m of Object.values(MUSTER_STATIONS)) expect(placeById(m.placeId)?.deck).toBe(m.deck)
  })

  it('marks what is not step-free and says why', () => {
    const noSteps = PLACES.filter((p) => !p.stepFree)
    expect(noSteps.length).toBeGreaterThan(0)
    for (const p of noSteps) expect(p.note, p.name).toBeTruthy()
  })
})

describe('daily programme', () => {
  it('lists each day in time order, in ship time', () => {
    const day2 = eventsOn(S, 2, false)
    expect(day2.length).toBeGreaterThan(8)
    expect(day2.map((e) => e.startAt)).toEqual([...day2.map((e) => e.startAt)].sort((a, b) => a - b))
    expect(day2.every((e) => e.day === 2 && e.date === '2027-03-22')).toBe(true)
    expect(eventsOn(S, 0, false)).toEqual([])
    expect(eventsOn(S, 9, false)).toEqual([])
  })

  it('holds the muster drill and sail-away on day 1 only', () => {
    const ids = (d: number) => eventsOn(S, d, false).map((e) => e.id)
    expect(ids(1)).toEqual(expect.arrayContaining(['muster', 'sailaway']))
    expect(ids(2)).not.toContain('muster')
  })

  it('keeps port-day evening events until the ship is back aboard', () => {
    const cozumel = eventsOn(S, 3, false)
    const aboard = zonedToEpoch('2027-03-23', '16:30', 'America/Cancun')
    for (const e of cozumel.filter((x) => x.afterAllAboard)) expect(e.startAt).toBeGreaterThanOrEqual(aboard)
    expect(cozumel.find((e) => e.id === 'port-quiet')?.startAt).toBeGreaterThanOrEqual(aboard)
  })

  it('follows the ship clock across the change in Belize', () => {
    const [toWest] = shipClockChanges(S)
    const day4 = eventsOn(S, 4, false).find((e) => e.id === 'port-show')!
    expect(day4.startAt).toBe(zonedToEpoch('2027-03-24', '20:30', 'America/Belize'))
    expect(toWest.toZone).toBe('America/Belize')
  })

  it('applies the mid-day changes only when asked, and says what moved and why', () => {
    const plain = eventsOn(S, 2, false)
    const changed = eventsOn(S, 2, true)
    expect(plain.every((e) => e.status === 'on')).toBe(true)
    const moved = changed.find((e) => e.id === 'stage-show')!
    expect(moved).toMatchObject({ status: 'moved', start: '21:15', was: '20:30' })
    expect(moved.reason).toBeTruthy()
    expect(moved.startAt - plain.find((e) => e.id === 'stage-show')!.startAt).toBe(45 * 60_000)
    expect(changed.find((e) => e.id === 'trivia')?.status).toBe('cancelled')
    expect(changed.length).toBe(plain.length)
    expect(PLAN_CHANGES.every((c) => c.reason.length > 0)).toBe(true)
  })

  it('filters by interest, who it is for, step-free access and cost', () => {
    const now = zonedToEpoch('2027-03-22', '09:00', 'America/New_York')
    const all = eventsOn(S, 2, false)
    const shows = filterEvents(all, { ...NO_EVENT_FILTER, interests: ['shows'] }, now)
    expect(shows.length).toBeGreaterThan(0)
    expect(shows.every((e) => e.interest === 'shows')).toBe(true)
    const kids = filterEvents(all, { ...NO_EVENT_FILTER, age: 'kids' }, now)
    expect(kids.every((e) => e.age === 'kids' || e.age === 'all')).toBe(true)
    expect(kids.some((e) => e.age === 'adults')).toBe(false)
    const paid = filterEvents(all, { ...NO_EVENT_FILTER, cost: 'extra' }, now)
    expect(paid.length).toBeGreaterThan(0)
    expect(paid.every((e) => e.extra > 0)).toBe(true)
    expect(filterEvents(all, { ...NO_EVENT_FILTER, cost: 'included' }, now).every((e) => e.extra === 0)).toBe(true)
    expect(filterEvents(all, { ...NO_EVENT_FILTER, stepFree: true }, now).every((e) => placeById(e.placeId)?.stepFree)).toBe(true)
    const late = zonedToEpoch('2027-03-22', '23:50', 'America/New_York')
    expect(filterEvents(all, { ...NO_EVENT_FILTER, upcomingOnly: true }, late).every((e) => e.endAt > late)).toBe(true)
  })

  it('sorts by time, place or deck', () => {
    const all = eventsOn(S, 2, false)
    const byDeck = sortEvents(all, 'deck').map((e) => placeById(e.placeId)!.deck)
    expect(byDeck).toEqual([...byDeck].sort((a, b) => a - b))
    const byVenue = sortEvents(all, 'venue').map((e) => placeById(e.placeId)!.name)
    expect(byVenue).toEqual([...byVenue].sort((a, b) => a.localeCompare(b)))
    expect(sortEvents(all, 'time').map((e) => e.startAt)).toEqual(all.map((e) => e.startAt))
  })

  it('finds what is on now and what comes next, skipping cancelled events', () => {
    const all = eventsOn(S, 2, true)
    const at = (time: string) => zonedToEpoch('2027-03-22', time, 'America/New_York')
    // Trivia (10:30) is cancelled, so only the craft hour is on at 10:40, and trivia is never "next".
    expect(nowAndNext(all, at('10:40')).now.map((e) => e.id)).toEqual(['craft'])
    expect(nowAndNext(all, at('10:15')).next.map((e) => e.id)).not.toContain('trivia')
    expect(nowAndNext(all, at('14:10')).now.map((e) => e.id)).toContain('bingo')
    expect(nowAndNext(all, at('23:59')).next).toEqual([])
    const n = nowAndNext(all, at('07:00'))
    expect(n.next.length).toBeGreaterThan(0)
    expect(new Set(n.next.map((e) => e.startAt)).size).toBe(1)
  })

  it('warns about overlaps in a plan but not about cancelled events', () => {
    const all = eventsOn(S, 2, false)
    const pick = (...ids: string[]) => all.filter((e) => ids.includes(e.id))
    expect(overlapping(pick('stage-show', 'dome-show'))).toEqual([])
    expect(overlapping(pick('stretch', 'craft')).length).toBe(0)
    const a = all.find((e) => e.id === 'trivia')!
    const b = { ...all.find((e) => e.id === 'cooking')!, startAt: a.startAt + 30 * 60_000, endAt: a.endAt + 30 * 60_000 }
    expect(overlapping([a, b]).length).toBe(1)
    expect(overlapping([{ ...a, status: 'cancelled' }, b])).toEqual([])
  })
})

describe('menus and diets', () => {
  const eclipse = directoryVenue('eclipse')!

  it('has hours that are open at the right times on sea and port days', () => {
    expect(openAt(eclipse, 'sea', '12:30')).toBe(true)
    expect(openAt(eclipse, 'port', '12:30')).toBe(false)
    expect(openAt(eclipse, 'sea', '09:30')).toBe(false)
    expect(openAt(directoryVenue('intl-cafe')!, 'port', '03:00')).toBe(true)
    expect(hoursText(eclipse.hours.sea, formatTime)).toContain('12:00 PM to 1:30 PM')
    expect(hoursText(directoryVenue('intl-cafe')!.hours.sea, formatTime)).toBe('')
  })

  it('hides what a diet avoids, and only that', () => {
    const soleil = directoryVenue('soleil')!
    const names = (diets: Parameters<typeof dishesFor>[1]) => dishesFor(soleil, diets).map((d) => d.name)
    expect(names([])).toHaveLength(soleil.dishes.length)
    expect(names(['shellfishAllergy'])).not.toContain('Shrimp cocktail')
    expect(names(['nutAllergy'])).not.toContain('Chocolate lava cake')
    expect(names(['vegetarian'])).toEqual(expect.arrayContaining(['French onion soup', 'Vegetable wellington']))
    expect(names(['vegetarian'])).not.toContain('Seared sea bass')
    expect(names(['vegan'])).not.toContain('French onion soup')
    expect(names(['glutenFree', 'dairyFree'])).not.toContain('French onion soup')
  })

  it('applies every diet in the list together', () => {
    const fish = DIRECTORY.flatMap((v) => v.dishes).find((d) => d.name === 'Seared sea bass')!
    expect(dishSuits(fish, 'glutenFree')).toBe(true)
    expect(dishSuits(fish, 'vegetarian')).toBe(false)
    expect(dishesFor(directoryVenue('soleil')!, ['vegetarian', 'glutenFree']).every((d) => !d.contains.includes('gluten') && !d.contains.includes('fish'))).toBe(true)
  })

  it('knows each reservable restaurant by the id the booking list uses', () => {
    for (const id of ['eclipse', 'crown', 'sabatini', 'catch', 'love', 'alfredo']) expect(directoryVenue(id), id).toBeDefined()
    expect(directoryVenue('nope')).toBeUndefined()
  })
})

describe('all aboard', () => {
  const cozumel = portDayAt(S, zonedToEpoch('2027-03-23', '09:00', 'America/Cancun'))!
  const belize = portDayAt(S, zonedToEpoch('2027-03-24', '09:00', 'America/Belize'))!

  it('states all-aboard in ship time with the local equivalent, one hour apart in Cozumel', () => {
    expect(cozumel).toMatchObject({ day: 3, port: 'cozumel', tender: false, shipZone: 'America/New_York', portZone: 'America/Cancun' })
    expect(cozumel.allAboardLocal).toBe('4:30 pm')
    expect(cozumel.allAboardShip).toBe('5:30 pm')
  })

  it('has no difference in Belize, where the ship runs on Belize time', () => {
    expect(belize).toMatchObject({ day: 4, tender: true, shipZone: 'America/Belize' })
    expect(belize.allAboardShip).toBe(belize.allAboardLocal)
  })

  it('moves to the next port once the ship has left, and ends after Roatán', () => {
    expect(portDayAt(S, zonedToEpoch('2027-03-23', '17:30', 'America/Cancun'))?.port).toBe('belize')
    expect(portDayAt(S, zonedToEpoch('2027-03-22', '12:00', 'America/New_York'))?.port).toBe('cozumel')
    expect(portDayAt(S, zonedToEpoch('2027-03-25', '18:00', 'America/Tegucigalpa'))).toBeNull()
  })

  it('counts down and changes level at two hours, thirty minutes, the deadline and the sailing', () => {
    const at = cozumel.allAboardAt
    const min = (m: number) => at - m * 60_000
    expect(aboardState(at, min(300)).level).toBe('plenty')
    expect(aboardState(at, min(121)).level).toBe('plenty')
    expect(aboardState(at, min(120)).level).toBe('soon')
    expect(aboardState(at, min(31)).level).toBe('soon')
    expect(aboardState(at, min(30))).toMatchObject({ level: 'now', minutesLeft: 30 })
    expect(aboardState(at, min(1)).level).toBe('now')
    expect(aboardState(at, at).level).toBe('late')
    expect(aboardState(at, at + 29 * 60_000).level).toBe('late')
    expect(aboardState(at, at + 30 * 60_000)).toMatchObject({ level: 'gone', minutesLeft: 0 })
  })

  it('lists reminders as they pass, with the next one still ahead', () => {
    const at = cozumel.allAboardAt
    expect(aboardState(at, at - 200 * 60_000)).toMatchObject({ reminders: [], nextReminder: 120 })
    expect(aboardState(at, at - 90 * 60_000)).toMatchObject({ reminders: [120], nextReminder: 60 })
    expect(aboardState(at, at - 20 * 60_000)).toMatchObject({ reminders: [120, 60, 30], nextReminder: null })
    expect(reminderTimes(at).map((r) => r.minutes)).toEqual([...REMINDER_THRESHOLDS])
    expect(reminderTimes(at)[0].at).toBe(at - 120 * 60_000)
  })

  it('puts tender guests in order and spreads the rest over four groups', () => {
    expect(tenderGroupFor({ shipTour: true, priority: true, assistance: false, seed: 'a' }).id).toBe('tour')
    expect(tenderGroupFor({ shipTour: false, priority: true, assistance: false, seed: 'a' }).id).toBe('priority')
    expect(tenderGroupFor({ shipTour: false, priority: false, assistance: true, seed: 'a' }).id).toBe('priority')
    const groups = new Set(Array.from({ length: 40 }, (_, i) => tenderGroupFor({ shipTour: false, priority: false, assistance: false, seed: `guest${i}` }).id))
    expect([...groups].every((g) => ['g1', 'g2', 'g3', 'g4'].includes(g))).toBe(true)
    expect(groups.size).toBeGreaterThan(1)
    expect(tenderGroupFor({ shipTour: false, priority: false, assistance: false, seed: 'same' })).toEqual(tenderGroupFor({ shipTour: false, priority: false, assistance: false, seed: 'same' }))
  })

  it('calls groups in order, later when the operation starts late, and finishes before all aboard', () => {
    const g1 = TENDER_GROUPS.find((g) => g.id === 'g1')!
    const first = zonedToEpoch('2027-03-24', '07:45', 'America/Belize')
    const onTime = tenderView(belize, g1, first - 10 * 60_000, 0)
    expect(onTime.callAt).toBe(first + 30 * 60_000)
    expect(onTime.status).toBe('waiting')
    expect(tenderView(belize, g1, first - 60 * 60_000, 0).status).toBe('before')
    expect(tenderView(belize, g1, onTime.callAt, 0).status).toBe('calling')
    expect(tenderView(belize, g1, onTime.callAt + 40 * 60_000, 0).status).toBe('running')
    const late = tenderView(belize, g1, first + 5 * 60_000, 40)
    expect(late.callAt).toBe(onTime.callAt + 40 * 60_000)
    expect(late.status).toBe('delayed')
    expect(late.lastTenderAt).toBeLessThan(belize.allAboardAt)
    expect(tenderView(belize, g1, first + 5 * 60_000, 0).lastTenderAt).toBe(late.lastTenderAt)
  })

  it('flags Roatán as a possible tender port only in the weather scenario', () => {
    expect(mayTenderInstead('roatan', true)).toBe(true)
    expect(mayTenderInstead('roatan', false)).toBe(false)
    expect(mayTenderInstead('cozumel', true)).toBe(false)
  })
})

const guest = (id: string, age: number, pkg: 'none' | 'plus' | 'premier', suite = false): FolioGuest => ({ id, firstName: id, age, entitlements: computeEntitlements({ tier: 'none', package: pkg, sanctuary: false }), suite })

describe('onboard account', () => {
  const input = (guests: FolioGuest[], throughDay: number) => ({ sailing: S, throughDay, guests, dining: [], welcomeCredit: false })

  it('has nothing before the cruise and grows each day', () => {
    const g = [guest('a', 40, 'none')]
    expect(buildFolio(input(g, 0))).toEqual([])
    expect(buildFolio(input(g, 3)).length).toBeGreaterThan(buildFolio(input(g, 1)).length)
  })

  it('gives the same lines every time for the same booking', () => {
    const g = [guest('a', 40, 'none'), guest('b', 38, 'plus')]
    expect(buildFolio(input(g, 7))).toEqual(buildFolio(input(g, 7)))
  })

  it('charges the daily gratuity per person for seven nights, more in a suite, and not at all when a package covers it', () => {
    const plain = buildFolio(input([guest('a', 40, 'none')], 8)).filter((l) => l.category === 'gratuities')
    expect(plain).toHaveLength(7)
    expect(plain.every((l) => l.cents === 1650)).toBe(true)
    const suite = buildFolio(input([guest('a', 40, 'none', true)], 8)).filter((l) => l.category === 'gratuities')
    expect(suite.every((l) => l.cents === 1850)).toBe(true)
    const covered = buildFolio(input([guest('a', 40, 'plus')], 8)).filter((l) => l.category === 'gratuities')
    expect(covered.every((l) => l.cents === 0 && l.coveredBy === 'package' && l.value === 1650)).toBe(true)
  })

  it('never charges a child for drinks or other purchases, only the daily gratuity', () => {
    const kid = buildFolio(input([guest('k', 9, 'none')], 8))
    expect(kid.every((l) => l.category === 'gratuities')).toBe(true)
  })

  it('lets a package pay for drinks up to its cap and charges the difference above it', () => {
    const lines = buildFolio(input([guest('a', 40, 'plus'), guest('b', 40, 'premier')], 7)).filter((l) => l.category === 'drinks')
    expect(lines.length).toBeGreaterThan(0)
    for (const l of lines) {
      const cap = l.guest === 'a' ? 1500 : 2000
      expect(l.coveredBy).toBe('package')
      expect(l.cents).toBe(Math.max(0, (l.value ?? 0) - cap))
    }
  })

  it('adds a service charge after a bar charge that was paid for', () => {
    const lines = buildFolio(input([guest('a', 40, 'none')], 7))
    for (const l of lines.filter((x) => x.category === 'drinks')) {
      const svc = lines.find((x) => x.id === `${l.id}-svc`)
      expect(svc?.cents).toBe(Math.round(l.cents * 0.18))
    }
  })

  it('charges the cover charge on a specialty dinner once per paying guest, and shows covered guests at no cost', () => {
    const lines = buildFolio({ ...input([guest('a', 40, 'none'), guest('b', 40, 'plus')], 7), dining: [{ id: 't1', day: 3, time: '19:00', venue: 'Crown Grill', guests: ['a', 'b'], charge: 4500, covered: ['b'] }] })
    const dine = lines.filter((l) => l.category === 'dining')
    expect(dine.find((l) => l.guest === 'a')).toMatchObject({ cents: 4500 })
    expect(dine.find((l) => l.guest === 'b')).toMatchObject({ cents: 0, coveredBy: 'package' })
  })

  it('adds a welcome credit that takes money off the total', () => {
    const lines = buildFolio({ ...input([guest('a', 40, 'none')], 1), welcomeCredit: true })
    const t = folioTotals(lines)
    expect(lines.find((l) => l.category === 'credit')?.cents).toBe(-5000)
    expect(t.credits).toBe(5000)
    expect(t.balance).toBe(t.charges - 5000)
  })

  it('totals charges, credits and package savings, with a running total that ends on the balance', () => {
    const lines = buildFolio({ ...input([guest('a', 40, 'plus'), guest('b', 12, 'none')], 7), welcomeCredit: true })
    const t = folioTotals(lines)
    expect(t.covered).toBeGreaterThan(0)
    expect(t.balance).toBe(t.charges - t.credits)
    expect(runningTotals(lines).at(-1)).toBe(t.balance)
    expect(runningTotals([])).toEqual([])
  })

  it('searches and filters by type, person and package savings', () => {
    const lines = buildFolio(input([guest('a', 40, 'plus'), guest('b', 40, 'none')], 7))
    expect(filterFolio(lines, { ...NO_FOLIO_FILTER, guest: 'a' }).every((l) => l.guest === 'a')).toBe(true)
    expect(filterFolio(lines, { ...NO_FOLIO_FILTER, category: 'gratuities' }).every((l) => l.category === 'gratuities')).toBe(true)
    expect(filterFolio(lines, { ...NO_FOLIO_FILTER, coveredOnly: true }).every((l) => !!l.coveredBy)).toBe(true)
    expect(filterFolio(lines, { ...NO_FOLIO_FILTER, query: 'GRATUITY' }).length).toBe(14)
    expect(filterFolio(lines, { ...NO_FOLIO_FILTER, query: 'no such thing' })).toEqual([])
  })
})

describe('guest services chat', () => {
  const channel = channelById('housekeeping')!
  const sent = 1_000_000_000_000
  const min = (m: number) => sent + m * 60_000

  it('reports waiting, then answered, then resolved, using the channel’s usual time', () => {
    expect(chatState(channel, sent, min(2), false, null)).toMatchObject({ status: 'waiting', waitedMinutes: 2, expectedMinutes: 10, canEscalate: false })
    expect(chatState(channel, sent, min(10), false, null).status).toBe('answered')
    expect(chatState(channel, sent, min(29), false, null).status).toBe('answered')
    expect(chatState(channel, sent, min(30), false, null).status).toBe('resolved')
  })

  it('shows a queue position that falls as the wait goes on and never reaches zero', () => {
    const q = [0, 3, 6, 9].map((m) => chatState(channel, sent, min(m), false, null).queue!)
    expect(q).toEqual([...q].sort((a, b) => b - a))
    expect(q.every((n) => n >= 1)).toBe(true)
  })

  it('takes longer when chat is slow, and offers a phone call straight away', () => {
    expect(replyAt(channel, sent, true) - replyAt(channel, sent, false)).toBe(channel.minutes * (SLOW_FACTOR - 1) * 60_000)
    const s = chatState(channel, sent, min(12), true, null)
    expect(s).toMatchObject({ status: 'waiting', expectedMinutes: 50, canEscalate: true })
  })

  it('offers a phone call after a long wait in normal times, and not before', () => {
    const slowish = { ...channel, minutes: 60 }
    expect(chatState(slowish, sent, min(ESCALATE_AFTER_MINUTES - 1), false, null).canEscalate).toBe(false)
    expect(chatState(slowish, sent, min(ESCALATE_AFTER_MINUTES), false, null).canEscalate).toBe(true)
  })

  it('stays escalated once a call is asked for', () => {
    expect(chatState(channel, sent, min(3), false, min(2))).toMatchObject({ status: 'escalated', canEscalate: false })
  })
})

describe('emergency card', () => {
  it('has the words to say, the stateroom and the station, and checks stored copies', () => {
    const c = emergencyCard('Gerald Whitfield', '8123', 8, 'Station C')
    expect(c.script).toBe('This is Gerald Whitfield. I need help in stateroom 8123, deck 8.')
    expect(c.musterPlace?.letter).toBe('C')
    expect(c.contacts.map((x) => x.label)).toEqual(['cabin', 'mobile', 'medical', 'guestServices'])
    expect(isEmergencyCard(JSON.parse(JSON.stringify(c)))).toBe(true)
    expect(isEmergencyCard({ guest: 'x' })).toBe(false)
    expect(isEmergencyCard(null)).toBe(false)
  })

  it('does not invent a station for an unknown label', () => {
    expect(emergencyCard('A', '1', 1, 'Somewhere').musterPlace).toBeNull()
  })
})
