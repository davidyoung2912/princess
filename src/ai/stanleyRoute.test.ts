import { describe, expect, it } from 'vitest'
import { actPath, answerActions, groupable, groupPath, routeQuestion, shipFactFor } from './stanleyRoute'

describe('routeQuestion', () => {
  it('sends a change to Ask your cruise, never acting itself', () => {
    expect(routeQuestion('Move dinner to 8pm', true).kind).toBe('act')
    expect(routeQuestion('I need extra towels please', true).kind).toBe('act')
  })
  it('does not offer changes before there is a booking, or when the server has switched actions off', () => {
    expect(routeQuestion('Can I cancel later?', false).kind).toBe('server')
    expect(routeQuestion('Move dinner to 8pm', true, false).kind).toBe('server')
  })
  it('answers a clear ship fact from ship data', () => {
    expect(routeQuestion('How fast does the ship go?', true)).toMatchObject({ kind: 'ship', fact: { id: 'speed' } })
  })
  it('ignores a single loose keyword', () => {
    expect(shipFactFor('Is Cozumel good for a tour?')).toBeNull()
  })
  it('leaves every other question to the server, which picks the source (no word lists on the device)', () => {
    for (const q of ['Which cabin has the best view?', 'What do I still need to do?', 'What is on my bill?', 'Is Roatán good for snorkelling?']) expect(routeQuestion(q, true)).toEqual({ kind: 'server' })
  })
})

describe('actPath', () => {
  it('carries the question, trimmed and encoded', () => {
    expect(actPath(' move dinner & show ')).toBe('/home/ask?q=move%20dinner%20%26%20show')
  })
})

describe('answer cards and the group', () => {
  const labels = { open: (n: string) => `Open ${n}`, show: 'Show me', group: 'Ask the group' }
  it('spots a question for the group', () => {
    expect(groupable('Who is bringing the cards?')).toBe(true)
    expect(groupable('What time is dinner?')).toBe(false)
    expect(groupPath('Who is bringing cards? ')).toBe('/plan/group-poll?q=Who%20is%20bringing%20cards%3F')
  })
  it('builds buttons from the link and the screens used, without repeats', () => {
    const acts = answerActions({ source: 'trip', answered: true, question: 'What is next?', link: '/a', citations: [{ label: 'Plan', path: '/a' }, { label: 'Bill', path: '/b' }, { label: 'X', path: '/c' }] }, labels)
    expect(acts.map((x) => x.path)).toEqual(['/a', '/b'])
  })
  it('offers the group when nothing answered', () => {
    expect(answerActions({ answered: false, question: 'Who has the tickets?' }, labels)).toEqual([{ label: 'Ask the group', path: '/plan/group-poll?q=Who%20has%20the%20tickets%3F' }])
  })
})
