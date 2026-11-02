import { describe, expect, it } from 'vitest'
import { ask, type Facts } from './assistant'
import { applyChanges, type PlanEntry } from './planChange'

/**
 * The assistant's evaluation set (XA-09): fixed questions with the answer they must give, and questions it must refuse to guess.
 * If a change to `ask` makes a grounded answer worse, or makes it start inventing, this fails.
 */
const e = (id: string, start: string, kind: PlanEntry['kind'] = 'event'): PlanEntry => ({ id, title: id, start, minutes: 60, kind, outdoor: false, path: '/plan' })
const FACTS: Facts = {
  nowHhmm: '12:00',
  plan: applyChanges([e('trivia', '10:30'), e('bingo', '14:00'), e('chops', '18:30', 'dinner')], []),
  todo: [{ label: 'Upload your passport', path: '/me/documents' }],
  charges: [{ label: 'Gratuities, day 3', cents: 1800, reason: 'A daily amount shared with the crew.' }],
  allAboard: '16:30',
}

interface Case { q: string; facts?: Partial<Facts>; includes: string[]; known: boolean; source?: string }
const GROUNDED: Case[] = [
  { q: 'What time is dinner?', includes: ['18:30', 'chops'], known: true, source: '/plan/dining' },
  { q: 'when is dinner tonight', includes: ['18:30'], known: true },
  { q: 'What is next?', includes: ['bingo', '14:00'], known: true, source: '/plan/day' },
  { q: 'what do I still need to do?', includes: ['Upload your passport'], known: true, source: '/plan/checklist' },
  { q: 'When must I be back on the ship?', includes: ['16:30'], known: true, source: '/ship/port' },
  { q: 'Why was I charged $18?', includes: ['Gratuities, day 3', 'crew'], known: true, source: '/me/bill' },
  { q: 'Summarise my day', includes: ['At 10:30: trivia.', 'At 18:30: chops.'], known: true, source: '/home/summary' },
  { q: 'give me a summary of my bill', includes: ['Gratuities, day 3: $18', 'crew'], known: true, source: '/me/bill' },
  { q: 'what time must I be back aboard', facts: { allAboard: null }, includes: ['not in a port'], known: true },
]
const MUST_NOT_GUESS: Case[] = [
  { q: 'What is the weather in Paris?', includes: ['I do not know'], known: false },
  { q: 'Will the ship be late tomorrow?', includes: ['I do not know'], known: false },
  { q: 'Why was I charged $99?', includes: ['cannot find'], known: false, source: '/me/bill' },
  { q: 'What do I still need to do?', facts: { todo: null }, includes: ['cannot see'], known: false },
  { q: 'Why was I charged $18?', facts: { charges: null }, includes: ['cannot see'], known: false },
]

describe('assistant evaluation set', () => {
  for (const c of [...GROUNDED, ...MUST_NOT_GUESS]) {
    it(`${c.known ? 'answers' : 'declines'}: ${c.q}${c.facts ? ' (changed facts)' : ''}`, () => {
      const a = ask(c.q, { ...FACTS, ...c.facts })
      expect(a.known).toBe(c.known)
      for (const s of c.includes) expect(a.text).toContain(s)
      if (c.source) expect(a.sources.map((s) => s.path)).toContain(c.source)
      if (c.known) expect(a.sources.length).toBeGreaterThan(0)
    })
  }

  it('never puts a fact in an answer that is not in the facts it was given', () => {
    const numbers = (s: string) => s.match(/\d{1,2}:\d{2}|\$\d+(?:\.\d\d)?/g) ?? []
    const given = JSON.stringify(FACTS)
    for (const c of GROUNDED) {
      const a = ask(c.q, { ...FACTS, ...c.facts })
      for (const n of numbers(a.text)) expect(given.includes(n.replace('$', '')) || given.includes(String(Number(n.replace('$', '')) * 100)), `${c.q}: ${n}`).toBe(true)
    }
  })
})
