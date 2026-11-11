import { describe, expect, it } from 'vitest'
import { isAskStanley, withAsk, canDraft, catchUpAnnouncement, cleanMinutes, hasHighlights, mayHelpWith, planSummary, showCatchUp, stanleyProblem, unreadAfter, UNREAD_THRESHOLD } from './chatStanley'

const m = (id: string, from: string, extra: Record<string, unknown> = {}) => ({ id, from, ...extra })

describe('unreadAfter', () => {
  const list = [m('1', 'ann'), m('2', 'bo'), m('3', 'me'), m('4', 'ann', { system: true }), m('5', 'bo', { stanley: true }), m('6', 'ann')]
  it('counts other people from the first unread message on', () => expect(unreadAfter(list, '2', 'me')).toBe(2))
  it('is zero with no divider', () => { expect(unreadAfter(list, null, 'me')).toBe(0); expect(unreadAfter(list, undefined, 'me')).toBe(0) })
  it('is zero when the divider message is not on the page', () => expect(unreadAfter(list, 'zz', 'me')).toBe(0))
})

describe('showCatchUp', () => {
  it('needs the help on and more than the threshold unread', () => {
    expect(showCatchUp({ available: true }, UNREAD_THRESHOLD + 1)).toBe(true)
    expect(showCatchUp({ available: true }, UNREAD_THRESHOLD)).toBe(false)
    expect(showCatchUp({ available: false }, 99)).toBe(false)
    expect(showCatchUp(undefined, 99)).toBe(false)
  })
})

describe('mayHelpWith', () => {
  const on = { available: true }
  const plain = { text: 'trivia at 7?', system: undefined, stanley: undefined, kind: undefined, deleted: undefined }
  it('offers plain text a person wrote', () => expect(mayHelpWith(on, plain)).toBe(true))
  it('is off when the server says so', () => expect(mayHelpWith({ available: false }, plain)).toBe(false))
  it('is not offered on system lines, Stanley, cards, polls, deleted or empty messages', () => {
    expect(mayHelpWith(on, { ...plain, system: true })).toBe(false)
    expect(mayHelpWith(on, { ...plain, stanley: true })).toBe(false)
    expect(mayHelpWith(on, { ...plain, kind: 'poll' })).toBe(false)
    expect(mayHelpWith(on, { ...plain, kind: 'card' })).toBe(false)
    expect(mayHelpWith(on, { ...plain, deleted: true })).toBe(false)
    expect(mayHelpWith(on, { ...plain, text: '  ' })).toBe(false)
  })
})

describe('stanleyProblem', () => {
  it('names each refusal', () => {
    expect(stanleyProblem('conflict', 'tooShort')).toBe('tooShort')
    expect(stanleyProblem('invalid', 'catchUpLimit')).toBe('limit')
    expect(stanleyProblem('forbidden', 'child')).toBe('child')
    expect(stanleyProblem('forbidden', 'off')).toBe('off')
    expect(stanleyProblem('invalid', 'noPlan')).toBe('noPlan')
    expect(stanleyProblem('invalid', 'draft')).toBe('draft')
  })
  it('reads a lost signal as offline and anything else as other', () => {
    expect(stanleyProblem('offline', 'offline')).toBe('offline')
    expect(stanleyProblem('network', undefined)).toBe('offline')
    expect(stanleyProblem('server', 'server')).toBe('other')
  })
})

describe('catch-up text', () => {
  it('knows when there are highlights', () => {
    expect(hasHighlights({ decided: [], open: [] })).toBe(false)
    expect(hasHighlights({ decided: ['x'], open: [] })).toBe(true)
  })
  it('announces the counts in one sentence', () => expect(catchUpAnnouncement({ messages: 40, decided: ['a'], open: ['b', 'c'] })).toBe('Summary of 40 messages: 1 that look decided, 2 still open.'))
})

describe('draft form', () => {
  it('accepts minutes from 5 to 180 only', () => {
    expect(cleanMinutes('10')).toBe(10)
    expect(cleanMinutes('4')).toBeUndefined()
    expect(cleanMinutes('181')).toBeUndefined()
    expect(cleanMinutes('1.5')).toBeUndefined()
    expect(cleanMinutes('')).toBeUndefined()
  })
  it('lets a late note go with blank minutes but not bad ones', () => {
    expect(canDraft('late', '', '')).toBe(true)
    expect(canDraft('late', '20', 'the pool')).toBe(true)
    expect(canDraft('late', '2', '')).toBe(false)
  })
  it('needs a place to meet, of a sensible length', () => {
    expect(canDraft('meet', '', '')).toBe(false)
    expect(canDraft('meet', '', 'the atrium')).toBe(true)
    expect(canDraft('meet', '', 'x'.repeat(41))).toBe(false)
  })
})

describe('planSummary', () => {
  it('reads the question and then each option', () => expect(planSummary({ question: 'Trivia at 7?', options: ["I'm in", 'Maybe'] })).toBe("Trivia at 7? I'm in, Maybe"))
})

describe('asking Stanley', () => {
  it('knows a message that starts with his name', () => {
    expect(isAskStanley('@Stanley what time is all aboard?')).toBe(true)
    expect(isAskStanley('  @stanley, hi')).toBe(true)
    expect(isAskStanley('did you ask @Stanley already?')).toBe(false)
    expect(isAskStanley('Stanley what time')).toBe(false)
    expect(isAskStanley('@StanleyFan hi')).toBe(false)
  })
  it('puts his name in front once', () => {
    expect(withAsk('')).toBe('@Stanley ')
    expect(withAsk('what is on in Cozumel?')).toBe('@Stanley what is on in Cozumel?')
    expect(withAsk('  hello')).toBe('@Stanley hello')
    expect(withAsk('@Stanley already')).toBe('@Stanley already')
  })
})
