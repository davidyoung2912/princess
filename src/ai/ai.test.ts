import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRecap, recapText } from '../domain/recap'
import { REFERENCE_SAILING } from '../domain/sailings'
import { screen } from './guard'
import { applyRemoteThread, clearThread, getThread, KEEP, mergeThreads, normalizeThread, setThread, threadKeyFor } from './history'
import type { ChatMessage, Context } from './types'

const ctx: Context = { sailingId: REFERENCE_SAILING.id, personaId: 'daniel', now: Date.UTC(2027, 0, 5, 12) }
const user = (text: string, at = ctx.now): ChatMessage => ({ id: `u${at}`, role: 'user', text, at })

describe('guard', () => {
  it('sends emergencies, medical, legal and person requests to people', () => {
    expect(screen('there is a fire in the corridor')).toBe('emergency')
    expect(screen('my son has chest pain')).toBe('emergency')
    expect(screen('what dosage of ibuprofen can I take')).toBe('medical')
    expect(screen('I want a lawyer')).toBe('legal')
    expect(screen('can I talk to a real person')).toBe('person')
    expect(screen('emergency and a doctor')).toBe('emergency')
  })
  it('lets ordinary questions through', () => {
    for (const m of ['what is the price in March', 'plan my day in Cozumel', 'where can we eat']) expect(screen(m)).toBeNull()
  })
})

describe('history', () => {
  let kept: Map<string, string>
  beforeEach(() => {
    kept = new Map()
    vi.stubGlobal('localStorage', { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => { kept.set(k, v) }, removeItem: (k: string) => { kept.delete(k) } })
  })
  it('keeps a thread per person, trims it, and clears it', () => {
    expect(getThread('daniel').messages).toEqual([])
    setThread('daniel', Array.from({ length: KEEP + 5 }, (_, i) => user(`m${i}`, i)))
    setThread('priya', [user('hi')])
    expect(getThread('daniel').messages).toHaveLength(KEEP)
    expect(getThread('daniel').messages[KEEP - 1].text).toBe(`m${KEEP + 4}`)
    expect(kept.get(threadKeyFor('daniel'))).toContain(`m${KEEP + 4}`)
    clearThread('daniel')
    expect(getThread('daniel').messages).toEqual([])
    expect(getThread('priya').messages).toHaveLength(1)
  })
  it('ignores damaged records', () => {
    expect(normalizeThread({ messages: [1, { role: 'user', text: 'ok', at: 1, id: 'x' }, { role: 'system' }, { role: 'assistant', text: 'a', at: 2, id: 'y', source: 'bogus', citations: [{ label: 'x', path: 'http://z' }] }] }).messages).toEqual([
      { id: 'x', role: 'user', text: 'ok', at: 1 }, { id: 'y', role: 'assistant', text: 'a', at: 2 },
    ])
    expect(normalizeThread('nope').messages).toEqual([])
  })
  it('takes the account’s copy, and joins two devices’ threads in time order', () => {
    applyRemoteThread('amy', normalizeThread({ messages: [{ id: 'a', role: 'user', text: 'hi', at: 1 }] }))
    expect(getThread('amy').messages).toHaveLength(1)
    const merged = mergeThreads({ messages: [{ id: 'b', role: 'user', text: 'two', at: 2 }, { id: 'a', role: 'user', text: 'hi', at: 1 }] }, { messages: [{ id: 'c', role: 'user', text: 'three', at: 3 }, { id: 'a', role: 'user', text: 'hi', at: 1 }] })
    expect(merged.messages.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('trip recap', () => {
  const input = { sailing: REFERENCE_SAILING, party: ['Daniel', 'Priya'], tours: ['coz-snorkel', 'nope'], dinners: ['crown', 'eclipse', 'crown', 'zzz'], photos: 12 }
  it('gathers the facts of the cruise', () => {
    const r = buildRecap(input)
    expect(r).toMatchObject({ nights: 7, seaDays: 3, photos: 12, dinnerCount: 3, tourNames: ['Reef snorkel by boat'] })
    expect(r.ports).toEqual(['Fort Lauderdale', 'Cozumel', 'Belize City', 'Roatán'])
    expect(r.favouriteMeal).toEqual({ name: 'Crown Grill', times: 2 })
  })
  it('handles a cruise with nothing booked', () => {
    const r = buildRecap({ ...input, tours: [], dinners: [], photos: 0 })
    expect(r.favouriteMeal).toBeNull()
    expect(recapText(r)).not.toContain('Ashore')
  })
  it('writes shareable text with first names only', () => {
    const text = recapText(buildRecap(input))
    expect(text).toContain('Daniel and Priya')
    expect(text).toContain('Favourite table: Crown Grill (2 dinners)')
    expect(text).not.toMatch(/Harper/)
  })
})

describe('trip recap distance and ship (AB7)', () => {
  const input = { sailing: REFERENCE_SAILING, party: ['Daniel'], tours: [], dinners: [], photos: 0 }
  it('leaves the distance out when it is not known and names the ship from the catalogue', async () => {
    const { SUSTAINABILITY, setVoyageMiles, milesPhrase } = await import('../domain/postcruise')
    const keep = SUSTAINABILITY.nauticalMiles
    try {
      setVoyageMiles(0)
      const r = buildRecap(input)
      expect(r.nauticalMiles).toBe(0)
      expect(recapText(r)).not.toContain('nautical')
      setVoyageMiles(3120)
      expect(recapText(buildRecap(input))).toContain('about 3,120 nautical miles')
      expect(milesPhrase(0)).toBe('')
    } finally { setVoyageMiles(keep) }
  })
})
