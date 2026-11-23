import { describe, expect, it } from 'vitest'
import { canAskReword, hasSuggestion, helpIsOn, offerOpeners, problemLine, REWORD_MAX, rewordProblem, showRewordHelp, useSuggestion } from './chatWriting'

describe('canAskReword', () => {
  it('needs something written, within the limit', () => {
    expect(canAskReword('hello')).toBe(true)
    expect(canAskReword('   ')).toBe(false)
    expect(canAskReword('a'.repeat(REWORD_MAX))).toBe(true)
    expect(canAskReword('a'.repeat(REWORD_MAX + 1))).toBe(false)
  })
})

describe('showRewordHelp', () => {
  it('shows only for a blocked message, when help is on and there is a draft', () => {
    expect(showRewordHelp('blocked', true, 'rude words')).toBe(true)
    expect(showRewordHelp('blocked', false, 'rude words')).toBe(false)
    expect(showRewordHelp('rate', true, 'rude words')).toBe(false)
    expect(showRewordHelp(null, true, 'rude words')).toBe(false)
    expect(showRewordHelp('blocked', true, '')).toBe(false)
  })
})

describe('rewordProblem', () => {
  it('names the failures', () => {
    expect(rewordProblem('offline', undefined)).toBe('offline')
    expect(rewordProblem('network', undefined)).toBe('offline')
    expect(rewordProblem('forbidden', 'supervised')).toBe('supervised')
    expect(rewordProblem('invalid', 'empty')).toBe('empty')
    expect(rewordProblem('server', undefined)).toBe('other')
  })
})

describe('hasSuggestion', () => {
  it('is true only for a non-blank suggestion', () => {
    expect(hasSuggestion({ suggestion: 'Could we meet?' })).toBe(true)
    expect(hasSuggestion({ suggestion: '  ' })).toBe(false)
    expect(hasSuggestion({})).toBe(false)
  })
})

describe('the status', () => {
  const status = { on: true, lines: { cooldown: 'Try again in a few days.' } }
  it('is off when missing or off', () => {
    expect(helpIsOn(undefined)).toBe(false)
    expect(helpIsOn({ on: false })).toBe(false)
    expect(helpIsOn(status)).toBe(true)
  })
  it('gives the server wording for a problem only when on', () => {
    expect(problemLine(status, 'cooldown')).toBe('Try again in a few days.')
    expect(problemLine(status, 'other')).toBeUndefined()
    expect(problemLine({ ...status, on: false }, 'cooldown')).toBeUndefined()
    expect(problemLine(undefined, 'cooldown')).toBeUndefined()
  })
})

describe('useSuggestion and openers', () => {
  it('cuts a suggestion to the box length', () => expect(useSuggestion('abcdef', 3)).toBe('abc'))
  it('offers openers only in an empty chat with help on', () => {
    expect(offerOpeners(true, 0, 0)).toBe(true)
    expect(offerOpeners(false, 0, 0)).toBe(false)
    expect(offerOpeners(true, 1, 0)).toBe(false)
    expect(offerOpeners(true, 0, 2)).toBe(false)
  })
})
