import { describe, expect, it } from 'vitest'
import { ITEMS, chargeFor, endTime, itemById, placesLeft, selectionProblem, takenByOthers } from './catalogue'
import { PLACES } from './deck'
import { HUNT, TRIVIA, achievements, bingoCard, bingoLines, calledNumbers, normalizeGame, triviaScore } from './games'
import { REFERENCE_SAILING } from './sailings'
import { searchContent } from './searchIndex'
import {
  BAR_MENU, ALERT_AFTER, STOP_AFTER, childSafeProblem, drinkSummary, friendProblem, gratuityDue, inCurrency, partyProblem, photoProblem, pinDigest, pinProblem, readyFor, reportProblem, requestStage, splitEvenly, systemStatus, topUpProblem,
} from './services'
import { noonReport } from './shipInfo'
import { CHANNELS, VOD, onNow, titleAllowed } from './tv'

const MIN = 60_000

describe('ship info (OB-06)', () => {
  it('gives the same report for the same day, in port and at sea', () => {
    const s = REFERENCE_SAILING
    expect(noonReport(s, 2)).toEqual(noonReport(s, 2))
    expect(noonReport(s, 2)).toMatchObject({ at: 'sea', next: 'cozumel' })
    expect(noonReport(s, 2).knots).toBeGreaterThan(0)
    expect(noonReport(s, 3)).toMatchObject({ at: 'cozumel', knots: 0, milesToNext: 0 })
    expect(noonReport(s, 99).day).toBe(8)
    for (let d = 1; d <= 8; d++) expect(noonReport(s, d).announcement.length).toBeGreaterThan(10)
  })
})

describe('search (OB-07)', () => {
  it('finds places, food and activities by any word', () => {
    expect(searchContent('pool').some((h) => h.title.includes('Pool'))).toBe(true)
    expect(searchContent('Italian').some((h) => h.id === 'sabatini')).toBe(true)
    expect(searchContent('bingo').map((h) => h.kind)).toEqual(expect.arrayContaining(['event', 'service']))
    expect(searchContent('massage')[0].to).toBe('/ship/spa')
  })

  it('needs every word, ignores accents and case, and says nothing for too little', () => {
    expect(searchContent('roatan').some((h) => h.kind === 'port')).toBe(true)
    expect(searchContent('italian pizza zzz')).toEqual([])
    expect(searchContent('a')).toEqual([])
    expect(searchContent('   ')).toEqual([])
  })

  it('puts a title match first and accepts screens from the caller', () => {
    expect(searchContent('spa')[0].title.toLowerCase()).toContain('spa')
    expect(searchContent('wallet', [{ kind: 'screen', id: '/x', title: 'Wallet', detail: '', to: '/x' }])[0].to).toBe('/x')
  })
})

describe('catalogue (ENT-03, SHP-01, SHP-04, SHP-06, ACS-04)', () => {
  it('only points at places on the deck plan, and has unique ids', () => {
    for (const i of ITEMS) if (i.placeId) expect(PLACES.some((p) => p.id === i.placeId), i.id).toBe(true)
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length)
  })

  it('works out end times and what others have taken', () => {
    expect(endTime('23:30', 60)).toBe('00:30')
    const spa = itemById('spa-swedish')!
    expect(takenByOthers(spa, 3, '10:00')).toBe(takenByOthers(spa, 3, '10:00'))
    expect(placesLeft(spa, 3, '10:00', 0)).toBeGreaterThan(0)
    expect(placesLeft(itemById('faith-mass')!, 2, '08:30', 0)).toBeNull()
  })

  it('checks a selection against its item', () => {
    const ok = { item: 'spa-swedish', day: 3, time: '10:00', qty: 1 }
    expect(selectionProblem(ok, 41)).toBeNull()
    expect(selectionProblem({ ...ok, item: 'nope' }, 41)).toBe('unknown')
    expect(selectionProblem(ok, 12)).toBe('age')
    expect(selectionProblem({ ...ok, day: 8 }, 41)).toBe('badDay')
    expect(selectionProblem({ ...ok, time: '03:00' }, 41)).toBe('badTime')
    expect(selectionProblem({ ...ok, qty: 2 }, 41, 3)).toBe('soldOut')
    expect(selectionProblem({ ...ok, qty: 0 }, 41)).toBe('badQty')
    expect(selectionProblem({ item: 'shop-hat', day: 0, time: '', qty: 2 }, 12)).toBeNull()
    expect(selectionProblem({ item: 'shop-hat', day: 2, time: '', qty: 1 }, 41)).toBe('notBookable')
    expect(chargeFor({ item: 'shop-hat', day: 0, time: '', qty: 2 })).toBe(5800)
    expect(chargeFor({ item: 'faith-mass', day: 2, time: '08:30', qty: 1 })).toBe(0)
  })

  it('marks captioned and signed shows', () => {
    expect(ITEMS.filter((i) => i.group === 'access').every((i) => (i.support?.length ?? 0) > 0)).toBe(true)
  })
})

describe('games (ENT-05)', () => {
  it('deals the same card for the same person, with a free middle and columns in range', () => {
    const card = bingoCard('daniel')
    expect(card).toEqual(bingoCard('daniel'))
    expect(card).not.toEqual(bingoCard('maria'))
    expect(card[2][2]).toBe(0)
    card.forEach((row) => row.forEach((n, c) => { if (n !== 0) { expect(n).toBeGreaterThan(c * 15); expect(n).toBeLessThanOrEqual(c * 15 + 15) } }))
    for (let c = 0; c < 5; c++) expect(new Set(card.map((r) => r[c])).size).toBe(5)
  })

  it('counts complete lines, including the free space', () => {
    const card = bingoCard('x')
    expect(bingoLines(card, [])).toBe(0)
    expect(bingoLines(card, card[0])).toBe(1)
    expect(bingoLines(card, [card[2][0], card[2][1], card[2][3], card[2][4]])).toBe(1)
    expect(bingoLines(card, card.flat().filter(Boolean))).toBe(12)
  })

  it('calls more numbers as time passes, the same for everyone', () => {
    expect(calledNumbers(2, 0)).toHaveLength(1)
    expect(calledNumbers(2, 20)).toHaveLength(11)
    expect(calledNumbers(2, 20).slice(0, 1)).toEqual(calledNumbers(2, 0))
    expect(calledNumbers(2, 9999)).toHaveLength(75)
  })

  it('cleans stored state, scores trivia and awards badges', () => {
    expect(normalizeGame({ found: ['h-pool', 'nope'], answers: { 'q-ports': 1, 'q-clock': 9 }, marked: [3, 99, 'x'] })).toEqual({ found: ['h-pool'], answers: { 'q-ports': 1 }, marked: [3] })
    expect(normalizeGame(null)).toEqual({ found: [], answers: {}, marked: [] })
    const all = { found: HUNT.map((c) => c.id), answers: Object.fromEntries(TRIVIA.map((q) => [q.id, q.answer])), marked: [] }
    expect(triviaScore(all)).toEqual({ right: TRIVIA.length, answered: TRIVIA.length })
    const card = bingoCard('x')
    expect(achievements(all, card).sort()).toEqual(['explorer', 'quiz', 'start'])
    expect(achievements({ ...all, marked: card[0] }, card)).toContain('bingo')
    expect(achievements({ found: [], answers: {}, marked: [] }, card)).toEqual([])
  })
})

describe('requests (MSG-03)', () => {
  it('moves from received to on the way to done, unless cancelled', () => {
    expect(requestStage(0, 20, 5 * MIN)).toBe('received')
    expect(requestStage(0, 20, 10 * MIN)).toBe('onTheWay')
    expect(requestStage(0, 20, 20 * MIN)).toBe('done')
    expect(requestStage(0, 20, 5 * MIN, 1)).toBe('cancelled')
  })
})

describe('security report (SAF-04)', () => {
  it('asks for a kind, a place and a few words', () => {
    expect(reportProblem('theft', 'Deck 9 pool', 'My bag was taken')).toBeNull()
    expect(reportProblem('x', 'Deck 9', 'something')).toBe('badKind')
    expect(reportProblem('theft', ' ', 'something')).toBe('noWhere')
    expect(reportProblem('theft', 'Deck 9', 'no')).toBe('noNote')
    expect(reportProblem('theft', 'Deck 9', 'x'.repeat(601))).toBe('tooLong')
  })
})

describe('drinks (DIN-06)', () => {
  const at = (n: number) => n * MIN
  const log = (ids: string[], start = 0) => ids.map((drinkId, i) => ({ id: String(i), drinkId, at: at(start + i * 10) }))
  it('counts covered drinks against the package cap and the price limit', () => {
    const s = drinkSummary(log(['beer', 'premiumCocktail', 'soda']), 15, at(60))
    expect(s).toMatchObject({ today: 3, covered: 2, paid: 1900, left: 13 })
    expect(drinkSummary(log(['beer', 'wine']), 0, at(60))).toMatchObject({ covered: 0, paid: 2000, left: null })
  })
  it('nudges at four alcoholic drinks in three hours, and stops at six', () => {
    expect(drinkSummary(log(Array(ALERT_AFTER - 1).fill('beer')), 15, at(60)).alert).toBe('none')
    expect(drinkSummary(log(Array(ALERT_AFTER).fill('beer')), 15, at(60)).alert).toBe('slow')
    expect(drinkSummary(log(Array(STOP_AFTER).fill('beer')), 15, at(70)).alert).toBe('stop')
    expect(drinkSummary(log(Array(STOP_AFTER).fill('mocktail')), 15, at(70)).alert).toBe('none')
    expect(drinkSummary(log(Array(STOP_AFTER).fill('beer')), 15, at(600)).alert).toBe('none')
  })
  it('has no drink that costs nothing', () => { expect(BAR_MENU.every((d) => d.cents > 0)).toBe(true) })
})

describe('group dining (DIN-09)', () => {
  it('splits so shares add up exactly, extra cents to the first', () => {
    expect(splitEvenly(1000, 3)).toEqual([334, 333, 333])
    expect(splitEvenly(1000, 3).reduce((a, b) => a + b, 0)).toBe(1000)
    expect(splitEvenly(5, 0)).toEqual([5])
  })
  it('checks a friend', () => {
    expect(friendProblem({ name: 'Sam', cabin: '8123' }, [], 2)).toBeNull()
    expect(friendProblem({ name: 'S', cabin: '8123' }, [], 2)).toBe('noName')
    expect(friendProblem({ name: 'Sam', cabin: '81' }, [], 2)).toBe('badCabin')
    expect(friendProblem({ name: 'sam', cabin: '8123' }, [{ name: 'Sam', cabin: '8123' }], 2)).toBe('duplicate')
    expect(friendProblem({ name: 'Sam', cabin: '8123' }, Array.from({ length: 6 }, (_, i) => ({ name: `F${i}`, cabin: '1000' })), 2)).toBe('full')
  })
})

describe('money (ACC-03, ACC-05, ACC-07)', () => {
  it('limits top-ups', () => {
    expect(topUpProblem(100, 0)).toBeNull()
    expect(topUpProblem(30, 0)).toBe('badAmount')
    expect(topUpProblem(2000, 0)).toBe('badAmount')
    expect(topUpProblem(1000, 1500)).toBe('tooMuch')
    expect(topUpProblem('100', 0)).toBe('badAmount')
  })
  it('rejects PINs that are easy to guess and never stores the PIN itself', () => {
    expect(pinProblem('4827')).toBeNull()
    expect(pinProblem('1111')).toBe('weak')
    expect(pinProblem('1234')).toBe('weak')
    expect(pinProblem('4321')).toBe('weak')
    expect(pinProblem('12a4')).toBe('format')
    expect(pinProblem(1234)).toBe('format')
    expect(pinDigest('4827', 'a')).not.toContain('4827')
    expect(pinDigest('4827', 'a')).not.toBe(pinDigest('4827', 'b'))
  })
  it('works out gratuities only for those who pay them', () => {
    expect(gratuityDue([{ suite: false, included: false }, { suite: true, included: false }, { suite: false, included: true }])).toBe(1650 * 7 + 1850 * 7)
    expect(gratuityDue([])).toBe(0)
  })
  it('shows amounts in another currency, and in dollars when it does not know the code', () => {
    expect(inCurrency(10000, 'USD')).toBe('$100.00')
    expect(inCurrency(10000, 'EUR')).toBe('€92.00')
    expect(inCurrency(-10000, 'GBP')).toBe('-£79.00')
    expect(inCurrency(10000, 'XXX')).toBe('$100.00')
  })
})

describe('cabin parties (ROM-06)', () => {
  const ok = { title: 'Sunset drinks', day: 3, time: '18:00', cabins: ['8123', '8125'] }
  it('checks a party', () => {
    expect(partyProblem(ok)).toBeNull()
    expect(partyProblem({ ...ok, title: ' ' })).toBe('noTitle')
    expect(partyProblem({ ...ok, day: 9 })).toBe('badDay')
    expect(partyProblem({ ...ok, time: '6pm' })).toBe('badTime')
    expect(partyProblem({ ...ok, time: '23:30' })).toBe('quiet')
    expect(partyProblem({ ...ok, time: '06:00' })).toBe('quiet')
    expect(partyProblem({ ...ok, cabins: [] })).toBe('noCabins')
    expect(partyProblem({ ...ok, cabins: ['1000', '1001', '1002', '1003', '1004', '1005', '1006'] })).toBe('tooMany')
    expect(partyProblem({ ...ok, cabins: ['8123', '8123'] })).toBe('badCabin')
    expect(partyProblem({ ...ok, cabins: ['81'] })).toBe('badCabin')
  })
})

describe('chat safeguards (MSG-01, MSG-05)', () => {
  it('keeps photos to adults, to known types and to a size', () => {
    expect(photoProblem('image/jpeg', 500_000, 30)).toBeNull()
    expect(photoProblem('image/jpeg', 500_000, 14)).toBe('age')
    expect(photoProblem('image/gif', 500_000, 30)).toBe('type')
    expect(photoProblem('image/png', 2_000_000, 30)).toBe('size')
    expect(photoProblem('image/png', 0, 30)).toBe('empty')
  })
  it('stops children passing on phone numbers and links', () => {
    expect(childSafeProblem('call me 555 123 4567', 14)).toBe('contactInfo')
    expect(childSafeProblem('see https://example.com', 14)).toBe('contactInfo')
    expect(childSafeProblem('see you at the pool at 3', 14)).toBeNull()
    expect(childSafeProblem('call me 555 123 4567', 41)).toBeNull()
  })
})

describe('status (SUP-04)', () => {
  it('lists every part and flags what the demo scenarios break', () => {
    const calm = systemStatus([], false)
    expect(calm.every((r) => r.health === 'ok' && !r.issue)).toBe(true)
    expect(systemStatus(['chatSlow'], false).find((r) => r.id === 'chat')).toMatchObject({ health: 'slow', issue: true })
    expect(systemStatus(['checkinDrop'], false).find((r) => r.id === 'checkin')?.health).toBe('down')
    expect(systemStatus([], true).every((r) => r.health === 'down')).toBe(true)
  })
})

describe('port day (POR-05, POR-07, POR-13) and TV (ENT-06)', () => {
  it('adds the tender item only at a tender port', () => {
    expect(readyFor(true).some((r) => r.id === 'tender')).toBe(true)
    expect(readyFor(false).some((r) => r.id === 'tender')).toBe(false)
  })
  it('has a programme for every channel and part of the day, and rates titles by age', () => {
    for (const c of CHANNELS) { expect(c.shows).toHaveLength(6); expect(onNow(c, 0)).toBe(c.shows[0]); expect(onNow(c, 23)).toBe(c.shows[5]) }
    expect(CHANNELS.map((c) => c.n)).toEqual(Array.from({ length: CHANNELS.length }, (_, i) => i + 1))
    expect(VOD.filter((v) => titleAllowed(v.rating, 6)).every((v) => v.rating === 'G')).toBe(true)
    expect(titleAllowed('PG-13', 14)).toBe(true)
    expect(titleAllowed('PG-13', 12)).toBe(false)
  })
})
