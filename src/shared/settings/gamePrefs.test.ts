// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { addResult, readPref, readRecord, readyForNext, writePref } from './gamePrefs'

describe('game preferences and records', () => {
  beforeEach(() => localStorage.clear())
  it('remembers a choice only when it is still a valid one', () => {
    expect(readPref('hex', 'skill', ['cadet', 'captain'] as const, 'captain')).toBe('captain')
    writePref('hex', 'skill', 'cadet')
    expect(readPref('hex', 'skill', ['cadet', 'captain'] as const, 'captain')).toBe('cadet')
    writePref('hex', 'skill', 'nonsense')
    expect(readPref('hex', 'skill', ['cadet', 'captain'] as const, 'captain')).toBe('captain')
  })
  it('keeps a record per game and opponent, with the best score of wins', () => {
    addResult('reversi', 'cadet', 'win', 40)
    addResult('reversi', 'cadet', 'win', 30)
    addResult('reversi', 'cadet', 'loss', 10)
    addResult('reversi', 'captain', 'draw')
    expect(readRecord('reversi', 'cadet')).toEqual({ w: 2, l: 1, d: 0, best: 30 })
    expect(readRecord('reversi', 'captain')).toEqual({ w: 0, l: 0, d: 1 })
    expect(readRecord('hex', 'cadet')).toEqual({ w: 0, l: 0, d: 0 })
  })
  it('survives unreadable data and suggests the next level after three clean wins', () => {
    localStorage.setItem('princess.gameRecords', 'not json')
    expect(readRecord('x', 'y')).toEqual({ w: 0, l: 0, d: 0 })
    for (let i = 0; i < 3; i++) addResult('x', 'cadet', 'win')
    expect(readyForNext(readRecord('x', 'cadet'))).toBe(true)
    addResult('x', 'cadet', 'loss')
    expect(readyForNext(readRecord('x', 'cadet'))).toBe(false)
  })
})
