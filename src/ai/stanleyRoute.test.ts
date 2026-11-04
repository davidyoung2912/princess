import { describe, expect, it } from 'vitest'
import { actPath, answerActions, groupable, groupPath, routeQuestion, shipFactFor } from './stanleyRoute'

describe('routeQuestion', () => {
  it('sends a change to Ask your cruise, never acting itself', () => {
    expect(routeQuestion('Move dinner to 8pm', 'sea', true).kind).toBe('act')
    expect(routeQuestion('I need extra towels please', 'sea', true).kind).toBe('act')
  })
  it('does not offer changes before there is a booking', () => {
    expect(routeQuestion('Can I cancel later?', 'dream', false).kind).toBe('before')
  })
  it('answers a clear ship fact from ship data', () => {
    expect(routeQuestion('How fast does the ship go?', 'sea', true)).toMatchObject({ kind: 'ship', fact: { id: 'speed' } })
  })
  it('ignores a single loose keyword', () => {
    expect(shipFactFor('Is Cozumel good for a tour?')).toBeNull()
  })
  it('uses the pre-booking source while choosing', () => {
    expect(routeQuestion('Which cabin has the best view?', 'discover', false).kind).toBe('before')
  })
  it('uses the trip source for the guest\'s own booking and plan', () => {
    expect(routeQuestion('What do I still need to do?', 'manage', true).kind).toBe('trip')
    expect(routeQuestion('What is on my bill?', 'sea', true).kind).toBe('trip')
  })
  it('leaves open questions to the Stanley model', () => {
    expect(routeQuestion('Is Roatán good for snorkelling?', 'sea', true).kind).toBe('model')
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
