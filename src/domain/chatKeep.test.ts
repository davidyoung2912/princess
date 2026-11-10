import { describe, expect, it } from 'vitest'
import type { ChatKeep } from '../api/chatTypes'
import { keptSummary, canFindPeople, canUseGuestServices, deleteDay, hasAgreed, keepDate, keepStatus, keptIds, keptUntil, waitingPhrase } from './chatKeep'

const DAY = Date.UTC(2027, 3, 19)
const KEPT_DAY = Date.UTC(2028, 2, 20)
const keep = (over: Partial<ChatKeep> = {}): ChatKeep => ({ id: 'c1', available: true, mine: false, kept: false, agreed: 0, total: 2, waiting: ['Sam R.'], standardDeleteOn: DAY, deleteOn: KEPT_DAY, needsGuardian: false, ...over })

describe('keepDate', () => {
  it('says the day itself whatever zone the phone is in', () => {
    expect(keepDate(KEPT_DAY)).toBe('March 20, 2028')
    expect(keepDate(DAY)).toBe('April 19, 2027')
  })
})

describe('keepStatus', () => {
  it('offers a chat the guest has not agreed to keep', () => expect(keepStatus(keep())).toBe('offer'))
  it('waits for the others once the guest has agreed', () => expect(keepStatus(keep({ mine: true, agreed: 1 }))).toBe('waiting'))
  it('says kept once everyone agreed', () => expect(keepStatus(keep({ mine: true, kept: true, agreed: 2, waiting: [] }))).toBe('kept'))
  it('leaves a supervised child to their guardian', () => expect(keepStatus(keep({ needsGuardian: true }))).toBe('guardian'))
  it('says so when a chat cannot be kept', () => expect(keepStatus(keep({ available: false, reason: 'permanent' }))).toBe('unavailable'))
  it('still says kept to a child when the guardian already agreed for everyone', () => expect(keepStatus(keep({ needsGuardian: true, kept: true }))).toBe('kept'))
})

describe('deleteDay', () => {
  it('is the standard day until the chat is kept, then the kept day', () => {
    expect(deleteDay(keep())).toBe(DAY)
    expect(deleteDay(keep({ kept: true }))).toBe(KEPT_DAY)
  })
})

describe('keptIds and keptUntil', () => {
  const list = [keep({ id: 'a', kept: true }), keep({ id: 'b' }), keep({ id: 'c', kept: true, available: false, reason: 'closed' })]
  it('tags only the chats that can be and are kept', () => {
    expect([...keptIds(list)]).toEqual(['a'])
    expect(keptUntil(list, 'a')).toBe(KEPT_DAY)
    expect(keptUntil(list, 'b')).toBeNull()
    expect(keptUntil(list, 'c')).toBeNull()
    expect(keptUntil(list, 'zzz')).toBeNull()
  })
})

describe('keptSummary', () => {
  it('counts the kept chats and gives the last day', () => {
    const a = keep({ id: 'a', kept: true, deleteOn: DAY }), b = keep({ id: 'b', kept: true, deleteOn: KEPT_DAY })
    expect(keptSummary([a, b, keep({ id: 'c' })])).toEqual({ count: 2, until: KEPT_DAY })
    expect(keptSummary([keep()])).toBeNull()
    expect(keptSummary([])).toBeNull()
  })
})

describe('hasAgreed', () => {
  it('follows the guest\'s own agreement', () => {
    expect(hasAgreed(keep({ mine: true }))).toBe(true)
    expect(hasAgreed(keep())).toBe(false)
  })
})

describe('canFindPeople', () => {
  it('is off before a booking and on otherwise, and on while the answer is unknown', () => {
    expect(canFindPeople({ stage: 'dream', stanley: true, party: false, people: false, guestServices: false, keep: false, reason: 'beforeBooking' })).toBe(false)
    expect(canFindPeople({ stage: 'sea', stanley: true, party: true, people: true, guestServices: true, keep: true })).toBe(true)
    expect(canFindPeople(null)).toBe(true)
    expect(canFindPeople(undefined)).toBe(true)
  })
})

describe('canUseGuestServices', () => {
  it('follows the booking and stays on while unknown', () => {
    expect(canUseGuestServices({ stage: 'dream', stanley: true, party: false, people: false, guestServices: false, keep: false, reason: 'beforeBooking' })).toBe(false)
    expect(canUseGuestServices({ stage: 'manage', stanley: true, party: true, people: true, guestServices: true, keep: true })).toBe(true)
    expect(canUseGuestServices(null)).toBe(true)
  })
})

describe('waitingPhrase', () => {
  it('names one, two, or two and a count', () => {
    expect(waitingPhrase([])).toBe('')
    expect(waitingPhrase(['Sam R.'])).toBe('Sam R.')
    expect(waitingPhrase(['Sam R.', 'Alex T.'])).toBe('Sam R. and Alex T.')
    expect(waitingPhrase(['Sam R.', 'Alex T.', 'Jo K.'])).toBe('Sam R., Alex T. and 1 other')
    expect(waitingPhrase(['A', 'B', 'C', 'D'])).toBe('A, B and 2 others')
  })
})
