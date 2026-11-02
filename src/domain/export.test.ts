import { describe, expect, test } from 'vitest'
import { buildIcsCalendar } from './calendar'
import {
  bagTagCard, cardLayout, compareQuery, parseCompareQuery, cardText, certificateCard, comparisonCard, journeyCalendar, keepsakeCard, momentCard, MOMENT_MAX, nextYearHold, planCalendar, posterCard, sameWeekNextYear, wrapText,
} from './export'
import { buildPlan } from './plan'
import { REFERENCE_SAILING } from './sailings'

const S = REFERENCE_SAILING
const plan = buildPlan(S, [], [])

describe('calendar files', () => {
  test('a timed event is written at its clock time without a zone', () => {
    const ics = buildIcsCalendar([{ uid: 'a', summary: 'x', description: '', location: '', start: '2027-03-21', end: '2027-03-21', stamp: 0, at: '16:30', minutes: 45 }])
    expect(ics).toContain('DTSTART:20270321T163000')
    expect(ics).toContain('DTEND:20270321T171500')
  })
  test('a zoned time is written in UTC at the right moment', () => {
    const ics = buildIcsCalendar([{ uid: 'a', summary: 'x', description: '', location: '', start: '2027-03-21', end: '2027-03-21', stamp: 0, at: '16:30', minutes: 30, zone: 'America/New_York' }])
    expect(ics).toContain('DTSTART:20270321T203000Z')
    expect(ics).toContain('DTEND:20270321T210000Z')
  })
  test('plan events use the port zone, and the ship zone at sea', () => {
    const entries = plan.map((d, i) => ({ ...d, entries: [{ kind: 'dinner' as const, time: '18:00', name: 'X', guests: [] }], gaps: [], day: i + 1 }))
    const sea = planCalendar(entries, 'day', 2, S, 'x', 0)
    expect(sea).toMatch(/DTSTART:\d{8}T\d{6}Z/)
  })
  test('a timed event that runs past midnight rolls to the next day', () => {
    const ics = buildIcsCalendar([{ uid: 'a', summary: 'x', description: '', location: '', start: '2027-03-21', end: '2027-03-21', stamp: 0, at: '23:30', minutes: 60 }])
    expect(ics).toContain('DTEND:20270322T003000')
  })
  test('the journey file has the sailing, check-in, final payment and sail-away; none when paid is skipped', () => {
    const base = { number: 'ABC123', sailing: S, finalDue: '2027-01-20', balanceText: '$1,200', checkinOpensDaysBefore: 3, home: 'Fort Lauderdale', shipName: 'Sun Princess', stamp: 0 }
    const ics = journeyCalendar(base)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(5)
    expect(ics).toContain('Final payment due')
    expect(ics).toContain('Balance: $1')
    expect(journeyCalendar({ ...base, finalDue: '' }).match(/BEGIN:VEVENT/g)).toHaveLength(4)
  })
  test('a day file holds that day only, a week file all of them, an empty plan none', () => {
    const entries = plan.map((d, i) => ({ ...d, entries: [{ kind: 'dinner' as const, time: '18:00', name: 'Crown Grill', guests: ['Jane'] }], gaps: [], day: i + 1 }))
    expect(planCalendar(entries, 'day', 2, S, 'Fort Lauderdale', 0).match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(planCalendar(entries, 'week', 1, S, 'Fort Lauderdale', 0).match(/BEGIN:VEVENT/g)?.length).toBe(entries.length)
    expect(planCalendar(entries.map((d) => ({ ...d, entries: [] })), 'week', 1, S, 'x', 0)).not.toContain('BEGIN:VEVENT')
  })
  test('next year is 52 weeks on and the hold is tentative and says nothing is booked', () => {
    expect(new Date(`${sameWeekNextYear('2027-03-21')}T12:00:00Z`).getUTCDay()).toBe(new Date('2027-03-21T12:00:00Z').getUTCDay())
    const ics = nextYearHold(S, 7, 'Sun Princess', 0)
    expect(ics).toContain('STATUS:TENTATIVE')
    expect(ics).toContain('Nothing is booked')
  })
})

describe('cards', () => {
  test('a bag tag carries the printed name, cabin and sailing, and large print is flagged', () => {
    const c = bagTagCard({ printed: 'SMITH/JANE', cabin: 'D312', deck: 9, sailing: S, shipName: 'Sun Princess', home: 'Fort Lauderdale', number: 'ABC123', large: true })
    expect(cardText(c)).toContain('SMITH/JANE')
    expect(c.large).toBe(true)
    expect(cardLayout(c).lines[0].size).toBeGreaterThan(cardLayout({ ...c, large: false }).lines[0].size)
  })
  test('the poster lists each day, with what is booked', () => {
    const p = posterCard({ title: 'Our week', sailing: S, plan: plan.map((d) => ({ ...d, entries: d.day === 3 ? [{ kind: 'tour' as const, time: '09:00', name: 'Snorkel', guests: [] }] : [] })), shipName: 'Sun Princess' })
    expect(p.lines).toHaveLength(plan.length)
    expect(p.lines[2]).toContain('Snorkel')
    expect(p.lines[1]).toContain('At sea')
  })
  test('the comparison card has a block per choice and a dash for a missing value', () => {
    const c = comparisonCard({ columns: ['A', 'B'], rows: [{ label: 'Price', values: ['$1'] }], note: 'n' })
    expect(c.lines).toEqual(['A', '  Price: $1', 'B', '  Price: -'])
  })
  test('the moment line is trimmed and capped', () => {
    expect(momentCard(`  ${'x'.repeat(300)}  `, 'Jane', 'dates').title).toHaveLength(MOMENT_MAX)
  })
  test('the certificate and keepsake read from the trip facts', () => {
    expect(cardText(certificateCard({ name: 'Jane', nights: 7, ports: ['Cozumel'], seaDays: 2, nauticalMiles: 1800, shipName: 'Sun Princess', dates: 'd' }))).toContain('1,800')
    const k = keepsakeCard({ title: 't', sailing: S, dinners: ['Crown Grill'], tours: [], shipName: 'Sun Princess' })
    expect(k.lines.some((l) => l.includes('Fort Lauderdale'))).toBe(true)
    expect(k.lines.at(-1)).toBe('Tables: Crown Grill')
    expect(k.lines.some((l) => l.startsWith('Ashore'))).toBe(false)
  })
  test('wrapping keeps long words whole and the layout leaves room for a photo', () => {
    expect(wrapText('aa bb cc', 5)).toEqual(['aa bb', 'cc'])
    expect(wrapText('abcdefghij k', 4)).toEqual(['abcdefghij', 'k'])
    const c = { ...momentCard('hi', 'me', 'd'), lines: Array.from({ length: 20 }, () => 'a line of text') }
    expect(cardLayout(c, true).height).toBeGreaterThan(cardLayout(c, false).height)
    expect(cardLayout(c, true).photoY).not.toBeNull()
  })
})

describe('comparison link', () => {
  test('round-trips the picks and caps them at three', () => {
    const q = compareQuery({ sailingId: 's1', guests: 2, fare: 'standard', picks: [1, 2, 3, 4].map((n) => ({ category: 'balcony', number: `B${n}` })) })
    const back = parseCompareQuery(q)
    expect(back).toMatchObject({ sailingId: 's1', guests: 2, fare: 'standard' })
    expect(back.picks).toHaveLength(3)
  })
  test('drops anything odd', () => {
    expect(parseCompareQuery('s=<script>&g=99&f=a b&c=:2,x')).toEqual({})
  })
})
