import { describe, expect, it } from 'vitest'
import { answerPressed, cleanMeetUpText, countsLine, hasHost, hostProblem, mayAsk, mayIntroduce, MEETUP_TITLE_MAX } from './chatHost'

describe('the host tools', () => {
  it('show in a room or made group only', () => {
    expect(hasHost({ kind: 'room' })).toBe(true)
    expect(hasHost({ kind: 'group' })).toBe(true)
    for (const kind of ['channel', 'direct', 'huddle', 'party', 'stanley'] as const) expect(hasHost({ kind } as never)).toBe(false)
  })
  it('offer introduce me in a room only', () => {
    expect(mayIntroduce({ kind: 'room' })).toBe(true)
    expect(mayIntroduce({ kind: 'group' })).toBe(false)
  })
})

describe('a meet-up', () => {
  it('tidies spaces and refuses links, numbers and emails', () => {
    expect(cleanMeetUpText('  Trivia   at the Piazza ', MEETUP_TITLE_MAX)).toBe('Trivia at the Piazza')
    expect(cleanMeetUpText('call 555 123 4567', 80)).toBeNull()
    expect(cleanMeetUpText('see www.example.com', 80)).toBeNull()
    expect(cleanMeetUpText('me@example.com', 80)).toBeNull()
    expect(cleanMeetUpText('', 80)).toBeNull()
    expect(cleanMeetUpText('x'.repeat(81), 80)).toBeNull()
  })
  it('counts in and maybe and nothing else', () => {
    const line = countsLine({ in: 3, maybe: 1 })
    expect(Object.keys(line).sort()).toEqual(['in', 'maybe'])
  })
  it('presses only the caller\'s own answer', () => {
    expect(answerPressed({ mine: 'maybe' }, 'maybe')).toBe(true)
    expect(answerPressed({ mine: 'maybe' }, 'in')).toBe(false)
    expect(answerPressed({}, 'in')).toBe(false)
  })
})

describe('host problems', () => {
  it('map the server titles', () => {
    expect(hostProblem('forbidden', 'supervised')).toBe('supervised')
    expect(hostProblem('tooManyRequests', 'limit')).toBe('limit')
    expect(hostProblem('invalid', 'contactInfo')).toBe('contactInfo')
    expect(hostProblem('network', undefined)).toBe('offline')
    expect(hostProblem('server', 'boom')).toBe('other')
  })
  it('keep a question within bounds', () => {
    expect(mayAsk('What time is the show?')).toBe(true)
    expect(mayAsk('   ')).toBe(false)
    expect(mayAsk('x'.repeat(201))).toBe(false)
  })
})
