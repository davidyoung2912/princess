import { describe, expect, it } from 'vitest'
import { addItem, addParty, balances, EMPTY_SPLIT, formatCents, markSettled, normalizeSplit, parseCents, removeItem, removeParty, settleUp, shares, totalShared, type SplitItem, type SplitState } from './ledgerSplit'
import { addRendezvous, agreePlan, anyoneOut, backCheck, clearPlan, dayOf, EMPTY_PORT_PARTY, meetView, normalizePortParty, planAgreed, presenceOf, proposePlan, removeRendezvous, setAlertBefore, setMeetState, setPlanB, setPresence } from './portParty'

const MIN = 60_000
const AT = 1_000_000_000_000
const DATE = '2027-03-23'
const members = [{ id: 'daniel', child: false }, { id: 'priya', child: false }, { id: 'maya', child: true }]

describe('back aboard (S6A-05)', () => {
  it('records where a person says they are, per day', () => {
    const s = setPresence(EMPTY_PORT_PARTY, DATE, 'daniel', 'leaving', AT)
    expect(presenceOf(dayOf(s, DATE), 'daniel')).toBe('leaving')
    expect(presenceOf(dayOf(s, DATE), 'priya')).toBeNull()
    expect(presenceOf(dayOf(s, '2027-03-24'), 'daniel')).toBeNull()
  })

  it('is not due before the chosen window, and is due inside it when anyone is not back', () => {
    const day = dayOf(EMPTY_PORT_PARTY, DATE)
    expect(backCheck(members, day, AT, 45, AT - 46 * MIN).due).toBe(false)
    expect(backCheck(members, day, AT, 45, AT - 45 * MIN).due).toBe(true)
    expect(backCheck(members, day, AT, 45, AT - 45 * MIN).missing).toEqual(['daniel', 'priya'])
  })

  it('lists a child apart from the adults and shows the gangway guidance under 30 minutes', () => {
    const c = backCheck(members, dayOf(EMPTY_PORT_PARTY, DATE), AT, 60, AT - 20 * MIN)
    expect(c.missingChildren).toEqual(['maya'])
    expect(c.missing).not.toContain('maya')
    expect(c.gangway).toBe(true)
    expect(backCheck(members, dayOf(EMPTY_PORT_PARTY, DATE), AT, 60, AT - 40 * MIN).gangway).toBe(false)
  })

  it('stops once everyone is back, and after all-aboard', () => {
    let s = EMPTY_PORT_PARTY
    for (const m of members) s = setPresence(s, DATE, m.id, 'back', AT - 90 * MIN)
    expect(backCheck(members, dayOf(s, DATE), AT, 90, AT - 30 * MIN).due).toBe(false)
    expect(anyoneOut(dayOf(s, DATE))).toBe(false)
    expect(backCheck(members, dayOf(EMPTY_PORT_PARTY, DATE), AT, 90, AT + MIN).due).toBe(false)
  })

  it('only accepts the offered alert times', () => {
    expect(setAlertBefore(EMPTY_PORT_PARTY, 60).alertBefore).toBe(60)
    expect(setAlertBefore(EMPTY_PORT_PARTY, 7).alertBefore).toBe(45)
  })
})

describe('the shared plan (S6A-06)', () => {
  const plan = { outing: 'coz-beach', title: 'Beach club day pass', travelMinutes: 20, buffer: 45 }

  it('starts with only the proposer agreeing and finishes when everyone has', () => {
    let s = proposePlan(EMPTY_PORT_PARTY, DATE, plan, 'daniel')
    const ids = members.map((m) => m.id)
    expect(planAgreed(dayOf(s, DATE).plan, ids)).toBe(false)
    s = agreePlan(agreePlan(s, DATE, 'priya'), DATE, 'priya')
    expect(dayOf(s, DATE).plan!.agreed).toEqual(['daniel', 'priya'])
    s = agreePlan(s, DATE, 'maya')
    expect(planAgreed(dayOf(s, DATE).plan, ids)).toBe(true)
  })

  it('a new proposal asks everyone again, and clearing leaves nothing', () => {
    let s = agreePlan(proposePlan(EMPTY_PORT_PARTY, DATE, plan, 'daniel'), DATE, 'priya')
    s = proposePlan(s, DATE, { ...plan, title: 'Ruins' }, 'priya')
    expect(dayOf(s, DATE).plan!.agreed).toEqual(['priya'])
    expect(dayOf(clearPlan(s, DATE), DATE).plan).toBeNull()
    expect(dayOf(agreePlan(EMPTY_PORT_PARTY, DATE, 'priya'), DATE).plan).toBeNull()
    expect(planAgreed(null, ['daniel'])).toBe(false)
  })

  it('keeps a plan B choice per day', () => {
    expect(dayOf(setPlanB(EMPTY_PORT_PARTY, DATE, 'rain'), DATE).planB).toBe('rain')
    expect(dayOf(setPlanB(setPlanB(EMPTY_PORT_PARTY, DATE, 'rain'), DATE, null), DATE).planB).toBeNull()
  })
})

describe('rendezvous (S6-12)', () => {
  const input = { place: 'Pier gate', at: AT, fallback: 'Guest Services desk', members: ['daniel', 'priya', 'maya'] }
  const kids = new Set(['maya'])

  it('starts the organiser on the way and everyone else waiting, and refuses an empty place', () => {
    const s = addRendezvous(EMPTY_PORT_PARTY, input, 'daniel', 'r1')
    expect(s.rendezvous[0].members).toEqual({ daniel: 'onway', priya: 'waiting', maya: 'waiting' })
    expect(addRendezvous(EMPTY_PORT_PARTY, { ...input, place: '   ' }, 'daniel', 'r2')).toBe(EMPTY_PORT_PARTY)
  })

  it('tracks on my way and here, and ignores people who are not in it', () => {
    let s = addRendezvous(EMPTY_PORT_PARTY, input, 'daniel', 'r1')
    s = setMeetState(setMeetState(s, 'r1', 'priya', 'here'), 'r1', 'stranger', 'here')
    const v = meetView(s.rendezvous[0], kids, AT - MIN)
    expect(v.here).toEqual(['priya'])
    expect(v.onway).toEqual(['daniel'])
    expect(v.waiting).toEqual(['maya'])
    expect(v.late).toBe(false)
  })

  it('goes quiet about a child until the time has passed, then tells adults only, and uses the fallback after the grace', () => {
    const s = addRendezvous(EMPTY_PORT_PARTY, input, 'daniel', 'r1')
    const r = s.rendezvous[0]
    expect(meetView(r, kids, AT - MIN).childLate).toEqual([])
    expect(meetView(r, kids, AT + MIN).childLate).toEqual(['maya'])
    expect(meetView(r, kids, AT + MIN).useFallback).toBe(false)
    expect(meetView(r, kids, AT + 15 * MIN).useFallback).toBe(true)
  })

  it('is not late once everyone is here', () => {
    let s = addRendezvous(EMPTY_PORT_PARTY, input, 'daniel', 'r1')
    for (const m of ['daniel', 'priya', 'maya']) s = setMeetState(s, 'r1', m, 'here')
    const v = meetView(s.rendezvous[0], kids, AT + 60 * MIN)
    expect(v.late).toBe(false)
    expect(v.useFallback).toBe(false)
  })

  it('only the organiser can remove it, and the list is capped', () => {
    const s = addRendezvous(EMPTY_PORT_PARTY, input, 'daniel', 'r1')
    expect(removeRendezvous(s, 'r1', 'priya').rendezvous).toHaveLength(1)
    expect(removeRendezvous(s, 'r1', 'daniel').rendezvous).toHaveLength(0)
    let many = EMPTY_PORT_PARTY
    for (let i = 0; i < 10; i++) many = addRendezvous(many, input, 'daniel', `r${i}`)
    expect(many.rendezvous).toHaveLength(6)
  })
})

describe('reading a saved port record', () => {
  it('drops anything malformed and keeps what is valid', () => {
    expect(normalizePortParty(null)).toEqual(EMPTY_PORT_PARTY)
    expect(normalizePortParty('x')).toEqual(EMPTY_PORT_PARTY)
    const s = normalizePortParty({
      alertBefore: 99,
      days: { 'not-a-date': {}, [DATE]: { presence: { daniel: { status: 'back', at: 1 }, priya: { status: 'flying', at: 1 } }, plan: { outing: 'x', title: 'T', agreed: ['daniel', 7] }, planB: 'rain' } },
      rendezvous: [{ id: 'r', place: 'Gate', at: 5, by: 'daniel', members: { daniel: 'here', priya: 'lost' } }, { id: 'bad' }],
    })
    expect(s.alertBefore).toBe(45)
    expect(Object.keys(s.days)).toEqual([DATE])
    expect(s.days[DATE].presence).toEqual({ daniel: { status: 'back', at: 1 } })
    expect(s.days[DATE].plan!.agreed).toEqual(['daniel'])
    expect(s.rendezvous).toHaveLength(1)
    expect(s.rendezvous[0].members).toEqual({ daniel: 'here' })
    expect(s.rendezvous[0].fallback).toBe('the ship’s gangway')
  })
})

describe('the split ledger (XG-03)', () => {
  const twoFamilies = (): SplitState => {
    let s = addParty(EMPTY_SPLIT, 'Harper', 4, 'h').state
    s = addParty(s, 'Brennan', 4, 'b').state
    return s
  }
  const add = (s: SplitState, amount: string, paidBy: string, among: string[], mode: 'equal' | 'byPeople' = 'equal', id = `i${s.items.length}`) =>
    addItem(s, { title: 'Taxi', kind: 'taxi', amount, paidBy, among, mode, date: null }, AT, id).state

  it('reads dollars into cents and shows cents as dollars', () => {
    expect(parseCents('12.50')).toBe(1250)
    expect(parseCents('$1,200')).toBe(120000)
    expect(parseCents('0.1')).toBe(10)
    for (const bad of ['', '0', '-5', 'abc', '1.234', '1e3', '999999999']) expect(parseCents(bad), bad).toBeNull()
    expect(formatCents(1250)).toBe('$12.50')
    expect(formatCents(-5)).toBe('-$0.05')
    expect(formatCents(120000)).toBe('$1,200.00')
  })

  it('splits equally, with leftover cents shared out so the shares add up', () => {
    const s = add(twoFamilies(), '10.01', 'h', ['h', 'b'])
    const sh = shares(s.items[0], s.parties)
    expect(sh.h + sh.b).toBe(1001)
    expect(sh).toEqual({ h: 501, b: 500 })
  })

  it('splits by head count', () => {
    let s = addParty(twoFamilies(), 'Okafor', 2, 'o').state
    s = add(s, '100', 'h', ['h', 'b', 'o'], 'byPeople')
    expect(shares(s.items[0], s.parties)).toEqual({ h: 4000, b: 4000, o: 2000 })
  })

  it('works out balances that add up to zero and the fewest payments', () => {
    let s = twoFamilies()
    s = add(s, '60', 'h', ['h', 'b'])
    s = add(s, '20', 'b', ['h', 'b'])
    const b = balances(s)
    expect(b).toEqual({ h: 2000, b: -2000 })
    expect(Object.values(b).reduce((a, c) => a + c, 0)).toBe(0)
    expect(settleUp(s)).toEqual([{ from: 'b', to: 'h', cents: 2000 }])
  })

  it('settles three families without paying anyone back and forth', () => {
    let s = addParty(twoFamilies(), 'Okafor', 2, 'o').state
    s = add(s, '90', 'h', ['h', 'b', 'o'])
    s = add(s, '30', 'b', ['h', 'b', 'o'])
    const transfers = settleUp(s)
    const net: Record<string, number> = { h: 0, b: 0, o: 0 }
    for (const t of transfers) { net[t.from] -= t.cents; net[t.to] += t.cents }
    expect(net).toEqual(balances(s))
    expect(transfers.length).toBeLessThanOrEqual(2)
    expect(transfers.every((t) => t.cents > 0 && t.from !== t.to)).toBe(true)
  })

  it('has nothing to settle when everyone is even or there is nothing', () => {
    expect(settleUp(EMPTY_SPLIT)).toEqual([])
    expect(settleUp(add(twoFamilies(), '10', 'h', ['h']))).toEqual([])
  })

  it('a family that pays for itself alone owes nobody', () => {
    const s = add(twoFamilies(), '50', 'h', ['h'])
    expect(balances(s)).toEqual({ h: 0, b: 0 })
  })

  it('refuses a bad item and says why', () => {
    const base = { title: 'Taxi', kind: 'taxi' as const, amount: '10', paidBy: 'h', among: ['h', 'b'], mode: 'equal' as const, date: null }
    const s = twoFamilies()
    expect(addItem(s, { ...base, title: ' ' }, AT, 'x').problem).toBe('title')
    expect(addItem(s, { ...base, amount: 'free' }, AT, 'x').problem).toBe('amount')
    expect(addItem(s, { ...base, paidBy: 'zzz' }, AT, 'x').problem).toBe('payer')
    expect(addItem(s, { ...base, among: ['zzz'] }, AT, 'x').problem).toBe('among')
    expect(addItem(s, base, AT, 'x').problem).toBeNull()
  })

  it('refuses a bad family: empty, duplicate, no people, too many', () => {
    const s = twoFamilies()
    expect(addParty(s, '  ', 2, 'x').problem).toBe('name')
    expect(addParty(s, 'harper', 2, 'x').problem).toBe('duplicate')
    expect(addParty(s, 'New', 0, 'x').problem).toBe('people')
    expect(addParty(s, 'New', 99, 'x').problem).toBe('people')
    let many = s
    for (let i = 0; i < 4; i++) many = addParty(many, `F${i}`, 1, `f${i}`).state
    expect(addParty(many, 'Extra', 1, 'x').problem).toBe('tooMany')
  })

  it('keeps a family that items still refer to, and removes an unused one', () => {
    const s = add(twoFamilies(), '10', 'h', ['h', 'b'])
    expect(removeParty(s, 'b').parties).toHaveLength(2)
    expect(removeParty(twoFamilies(), 'b').parties).toHaveLength(1)
  })

  it('removing an item changes the balances, adding one clears the settled mark', () => {
    let s = add(twoFamilies(), '60', 'h', ['h', 'b'])
    s = markSettled(s, AT)
    expect(s.settledAt).toBe(AT)
    expect(add(s, '5', 'h', ['h', 'b']).settledAt).toBeNull()
    expect(balances(removeItem(s, s.items[0].id))).toEqual({ h: 0, b: 0 })
    expect(totalShared(s)).toBe(6000)
  })

  it('reads a saved record, dropping items that refer to nobody', () => {
    const good: SplitItem = { id: 'a', title: 'Taxi', kind: 'taxi', cents: 500, paidBy: 'h', among: ['h', 'b'], mode: 'equal', at: 1, date: null }
    const s = normalizeSplit({
      parties: [{ id: 'h', name: 'Harper', people: 4 }, { id: 'b', name: 'Brennan', people: 99 }, { id: 'x', name: '', people: 2 }],
      items: [good, { ...good, id: 'b', paidBy: 'ghost' }, { ...good, id: 'c', cents: -5 }, { ...good, id: 'd', cents: 1.5 }, { ...good, id: 'e', among: ['ghost'] }, { ...good, id: 'f', among: ['h', 'ghost'], kind: 'weird' }],
      settledAt: 'soon',
    })
    expect(s.parties.map((p) => p.people)).toEqual([4, 12])
    expect(s.items.map((i) => i.id)).toEqual(['a', 'f'])
    expect(s.items[1].among).toEqual(['h'])
    expect(s.items[1].kind).toBe('other')
    expect(s.settledAt).toBeNull()
    expect(normalizeSplit(undefined)).toEqual(EMPTY_SPLIT)
  })
})
