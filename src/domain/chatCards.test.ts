import { describe, expect, it } from 'vitest'
import type { ChatCard, ChatShareable } from '../api/chatTypes'
import { canAddPin, canEditKind, cardLink, cardSummary, cleanNote, insertMention, isExpired, isTyped, matchPeople, MAX_PINS, mentionedIds, mentionParts, mentionQuery, NOTE_MAX, pinOffer, sortPlaces, sortShareables } from './chatCards'

const people = [{ id: 'p1', name: 'Sam R.' }, { id: 'p2', name: 'Priya U.' }, { id: 'p3', name: 'Álvaro M.' }]
const clock = (t: string) => t

describe('cards', () => {
  it('a place stops being current when its time passes, on the server mark or on its own expiry', () => {
    expect(isExpired({ expiresAt: 1000 }, 999)).toBe(false)
    expect(isExpired({ expiresAt: 1000 }, 1000)).toBe(true)
    expect(isExpired({ expired: true }, 0)).toBe(true)
    expect(isExpired({}, Number.MAX_SAFE_INTEGER)).toBe(false)   // a card with no expiry does not go stale by time
  })

  it('a card links only to a screen the app has; anything else is no longer available', () => {
    expect(cardLink({ type: 'excursion', path: '/plan/excursions' })).toBe('/plan/excursions')
    expect(cardLink({ type: 'dining', path: '/plan/dining' })).toBe('/plan/dining')
    expect(cardLink({ type: 'portDay', path: '/home/ports/cozumel' })).toBe('/home/ports/cozumel')
    expect(cardLink({ type: 'booking', path: '/plan/reservations' })).toBe('/plan/reservations')
    expect(cardLink({ type: 'excursion', path: 'https://evil.example/plan/excursions' })).toBeNull()
    expect(cardLink({ type: 'excursion', path: '//evil.example' })).toBeNull()
    expect(cardLink({ type: 'excursion', path: '/admin' })).toBeNull()
    expect(cardLink({ type: 'excursion' })).toBeNull()
    expect(cardLink({ type: 'place', path: '/plan/dining' })).toBeNull()
  })

  it('a message is typed when it has a kind and its card', () => {
    const card: ChatCard = { type: 'place', title: 'Piazza' }
    expect(isTyped({ kind: 'place', card })).toBe(true)
    expect(isTyped({ kind: 'place' })).toBe(false)
    expect(isTyped({})).toBe(false)
    expect(canEditKind({})).toBe(true)
    expect(canEditKind({ kind: 'card' })).toBe(false)
  })

  it('the summary names the title, the day and time and the place once', () => {
    expect(cardSummary({ type: 'dining', title: 'Crown Grill', day: 2, time: '19:00', place: 'Deck 7 aft' }, clock)).toBe('Crown Grill · day 2, 19:00 · Deck 7 aft')
    expect(cardSummary({ type: 'place', title: 'Piazza', place: 'Piazza' }, clock)).toBe('Piazza')
  })

  it('the share list is the booking, port days, excursions and dinners, each by day and time', () => {
    const items: ChatShareable[] = [
      { ref: 'd2', type: 'dining', title: 'B', day: 2, time: '19:00' },
      { ref: 'e3', type: 'excursion', title: 'C', day: 3, time: '08:30' },
      { ref: 'e2', type: 'excursion', title: 'A', day: 2, time: '09:00' },
      { ref: 'b', type: 'booking', title: 'Trip' },
      { ref: 'p3', type: 'portDay', title: 'Cozumel', day: 3 },
    ]
    expect(sortShareables(items).map((i) => i.ref)).toEqual(['b', 'p3', 'e2', 'e3', 'd2'])
    expect(items[0].ref).toBe('d2')   // the original list is untouched
  })

  it('places sort by deck then name', () => {
    expect(sortPlaces([{ id: 'b', name: 'B', deck: 7, section: 'mid' }, { id: 'a', name: 'A', deck: 5, section: 'mid' }, { id: 'c', name: 'A', deck: 7, section: 'aft' }]).map((p) => p.id)).toEqual(['a', 'c', 'b'])
  })

  it('a note is one short line', () => {
    expect(cleanNote('  by the\n  fountain ')).toBe('by the fountain')
    expect(cleanNote('x'.repeat(200))).toHaveLength(NOTE_MAX)
  })
})

describe('pins', () => {
  it('only three fit', () => {
    expect(canAddPin(MAX_PINS - 1)).toBe(true)
    expect(canAddPin(MAX_PINS)).toBe(false)
  })

  it('Pin is offered where the server allows it and there is room; Unpin whenever it is pinned', () => {
    const plain = { system: false, stanley: false, deleted: false, pinned: false }
    expect(pinOffer(plain, true, 0)).toBe('pin')
    expect(pinOffer(plain, true, MAX_PINS)).toBeNull()
    expect(pinOffer({ ...plain, pinned: true }, true, MAX_PINS)).toBe('unpin')
    expect(pinOffer(plain, false, 0)).toBeNull()
    expect(pinOffer({ ...plain, system: true }, true, 0)).toBeNull()
    expect(pinOffer({ ...plain, stanley: true }, true, 0)).toBeNull()
    expect(pinOffer({ ...plain, deleted: true }, true, 0)).toBeNull()
  })
})

describe('mentions', () => {
  it('finds the @word at the caret, only at the start of a word', () => {
    expect(mentionQuery('hi @Sa', 6)).toEqual({ start: 3, query: 'Sa' })
    expect(mentionQuery('@', 1)).toEqual({ start: 0, query: '' })
    expect(mentionQuery('mail me@home', 12)).toBeNull()
    expect(mentionQuery('hi @Sam and', 11)).toBeNull()   // the caret is past the word
    expect(mentionQuery('hi @Sam and', 7)).toEqual({ start: 3, query: 'Sam' })
  })

  it('matches first names by prefix, ignoring case and accents', () => {
    expect(matchPeople(people, 'sa').map((p) => p.id)).toEqual(['p1'])
    expect(matchPeople(people, 'alv').map((p) => p.id)).toEqual(['p3'])
    expect(matchPeople(people, '')).toHaveLength(3)
    expect(matchPeople(people, '', 2)).toHaveLength(2)
    expect(matchPeople(people, 'zz')).toEqual([])
  })

  it('picking a person replaces the word and puts the caret after the name', () => {
    expect(insertMention('hi @Sa there', 6, 3, people[0])).toEqual({ text: 'hi @Sam R.  there', caret: 11 })
  })

  it('a message names the people whose @Name it holds, once, and not a longer name', () => {
    expect(mentionedIds('@Sam R. and @Priya U. and @Sam R.', people)).toEqual(['p1', 'p2'])
    expect(mentionedIds('@Samuel', [{ id: 'x', name: 'Sam' }])).toEqual([])
    expect(mentionedIds('no one', people)).toEqual([])
    expect(mentionedIds('(@Sam R.)', people)).toEqual(['p1'])
  })

  it('cuts the text into plain and name parts', () => {
    expect(mentionParts('hey @Sam R. lunch?')).toEqual([{ text: 'hey ', mention: false }, { text: '@Sam R.', mention: true }, { text: ' lunch?', mention: false }])
    expect(mentionParts('plain')).toEqual([{ text: 'plain', mention: false }])
    expect(mentionParts('')).toEqual([])
    expect(mentionParts('mail me@home')).toEqual([{ text: 'mail me', mention: false }, { text: '@home', mention: true }])
  })
})
