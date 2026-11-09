import { describe, expect, it } from 'vitest'
import { JOURNEY_STAGES } from './hubs'
import { EMPTY_PROGRESS, markVisited, MAX_PROGRESS_ENTRIES, mergeProgress, normalizeProgress, progressKey, stepsAt, wasVisited } from './stageProgress'
import { welcomeContent } from './stageWelcome'

describe('progress keys', () => {
  it('follow the welcome key, then # and the step', () => {
    expect(progressKey('dream', 'sun-1', 2)).toBe('dream#2')
    expect(progressKey('manage', 'sun-1', 1)).toBe('manage:sun-1#1')
    expect(progressKey('manage', null, 3)).toBe('manage#3')
  })

  it('never has more steps in a stage than the server allows', () => {
    for (const s of JOURNEY_STAGES) expect(welcomeContent(s).steps.length).toBeLessThanOrEqual(9)
  })
})

describe('reading and merging the document', () => {
  it('drops odd keys and non-numbers', () => {
    expect(normalizeProgress(null)).toBe(EMPTY_PROGRESS)
    expect(normalizeProgress({ visited: { 'dream#1': 5, 'nonsense#1': 5, 'dream#0': 5, 'dream#10': 5, dream: 5, 'dream#2': 'x', 'manage:a b#1': 5, 'manage:s1#2': 7 } }).visited)
      .toEqual({ 'dream#1': 5, 'manage:s1#2': 7 })
  })

  it('keeps every visit, the earliest time for one both devices saw', () => {
    expect(mergeProgress({ visited: { 'dream#1': 9, 'dream#2': 3 } }, { visited: { 'dream#1': 4, 'dream#3': 8 } }).visited).toEqual({ 'dream#1': 4, 'dream#2': 3, 'dream#3': 8 })
  })

  it('records a visit once and keeps at most the server limit', () => {
    const one = markVisited(EMPTY_PROGRESS, 'dream#1', 1)
    expect(markVisited(one, 'dream#1', 2)).toBe(one)
    expect(markVisited(one, 'bad#1', 2)).toBe(one)
    expect(wasVisited(one, 'dream', null, 1)).toBe(true)
    expect(wasVisited(one, 'dream', null, 2)).toBe(false)
    const many = { visited: Object.fromEntries(Array.from({ length: MAX_PROGRESS_ENTRIES }, (_, i) => [`manage:s${i}#1`, i])) }
    expect(Object.keys(markVisited(many, 'dream#1', 999).visited)).toHaveLength(MAX_PROGRESS_ENTRIES)
  })
})

describe('which steps a screen is the way to', () => {
  it('matches a step\'s address and the screens under it, not a lookalike', () => {
    expect(stepsAt('dream', '/home/quiz')).toEqual([1])
    expect(stepsAt('dream', '/home/quiz/')).toEqual([1])
    expect(stepsAt('dream', '/home/quiz/results')).toEqual([1])
    expect(stepsAt('dream', '/home/quizzes')).toEqual([])
    expect(stepsAt('dream', '/')).toEqual([])
  })
})

describe('steps whose link depends on the guest\'s data', () => {
  it('counts the booking screens for the right booking step', () => {
    expect(stepsAt('book', '/book')).toEqual([1])
    expect(stepsAt('book', '/book/resume/d1')).toEqual([1])
    expect(stepsAt('book', '/book/pay/d1')).toEqual([2])
    expect(stepsAt('book', '/plan/party')).toEqual([3])
  })

  it('counts either way into a step that can be reached two ways', () => {
    expect(stepsAt('manage', '/book/pay/T123')).toEqual([1])
    expect(stepsAt('manage', '/me/payments')).toEqual([1])
    expect(stepsAt('getToShip', '/home/check-in/T123')).toEqual([1])
    expect(stepsAt('getToShip', '/home/boarding-pass')).toEqual([1])
  })
})
