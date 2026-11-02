import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDay, NO_WISH } from '../domain/day'
import { buildRecap, recapText } from '../domain/recap'
import { REFERENCE_SAILING } from '../domain/sailings'
import { ask, askProblem, normalizeTurn } from './concierge'
import { MAX_MESSAGE, screen } from './guard'
import { applyRemoteThread, clearThread, getThread, KEEP, mergeThreads, normalizeThread, setThread, threadKeyFor } from './history'
import { scriptedReply } from './scripted'
import { runTool, TOOLS } from './tools'
import type { ChatMessage, Context } from './types'

const ctx: Context = { sailingId: REFERENCE_SAILING.id, personaId: 'daniel', now: Date.UTC(2027, 0, 5, 12) }
const user = (text: string, at = ctx.now): ChatMessage => ({ id: `u${at}`, role: 'user', text, at })
const json = (r: { content: string }) => JSON.parse(r.content) as Record<string, unknown>

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
  it('checks the message length', () => {
    expect(askProblem('  ')).toBe('empty')
    expect(askProblem('a'.repeat(MAX_MESSAGE + 1))).toBe('long')
    expect(askProblem('hello')).toBeNull()
  })
})

describe('tools', () => {
  it('has a schema for every tool it can run', () => {
    for (const tool of TOOLS) expect(runTool(tool.name, {}, ctx).content, tool.name).toBeTruthy()
  })
  it('lists the sailings with prices and cites them', () => {
    const r = runTool('list_sailings', { month: '2027-03' }, ctx)
    expect((json(r).sailings as unknown[]).length).toBe(1)
    expect(r.citations[0].path).toBe(`/home/sailings/${REFERENCE_SAILING.id}`)
    expect(runTool('list_sailings', {}, ctx).citations[0].path).toBe('/home/sailings')
  })
  it('filters excursions the same way the screen does', () => {
    const r = json(runTool('search_excursions', { port: 'cozumel', wheelchair: true }, ctx)).excursions as { id: string; wheelchair: boolean; port: string }[]
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((x) => x.wheelchair && x.port === 'cozumel')).toBe(true)
  })
  it('answers bad input with an error, never a throw', () => {
    expect(runTool('get_port', { port: 'atlantis' }, ctx).isError).toBe(true)
    expect(runTool('build_day', { day: 12 }, ctx).isError).toBe(true)
    expect(runTool('get_itinerary', { sailing_id: 'nope' }, ctx).isError).toBe(true)
    expect(runTool('book_cruise', {}, ctx).isError).toBe(true)
  })
  it('describes the guest’s own party', () => {
    const trip = json(runTool('my_trip', {}, ctx))
    expect((trip.party as unknown[]).length).toBe(4)
    expect(runTool('my_trip', {}, { ...ctx, personaId: 'nobody' }).isError).toBe(true)
  })
})

describe('scripted concierge', () => {
  it('answers about prices from the sailings', () => {
    const r = scriptedReply('how much does it cost in 2027-03?', ctx)
    expect(r.source).toBe('scripted')
    expect(r.text).toContain('2027-03-21')
    expect(r.citations.length).toBeGreaterThan(0)
  })
  it('says it covers one cruise when asked about somewhere else', () => {
    expect(scriptedReply('plan a 7-night Alaska trip in June for 4', ctx).text).toContain('one cruise')
  })
  it('does not book or take payment', () => {
    const r = scriptedReply('please book it for me', ctx)
    expect(r.text).toContain('cannot book')
    expect(r.citations[0].path).toBe('/book')
  })
  it('builds a day for a port from the words used', () => {
    const r = scriptedReply('plan my day in Cozumel, we like snorkel and have a kid', ctx)
    expect(r.text).toContain('Be back on the ship by')
    expect(r.citations[0].path).toBe('/plan/day')
  })
  it('is honest when it cannot place a question', () => {
    expect(scriptedReply('xyzzy', ctx).citations).toEqual([])
  })
})

describe('ask', () => {
  const served = { text: 'From the model.', citations: [{ label: 'Dining', path: '/plan/dining' }], source: 'claude', handoff: null, fallback: null }

  it('never sends a handoff message to the server', async () => {
    let called = false
    const send = async () => { called = true; return served }
    const turn = await ask(send, [user('he is unconscious')], ctx)
    expect(turn.handoff).toBe('emergency')
    expect(called).toBe(false)
  })
  it('uses the built-in helper in mock mode', async () => {
    const turn = await ask(null, [user('where can we eat dinner')], ctx)
    expect(turn.reply.source).toBe('scripted')
    expect(turn.fallback).toBeNull()
  })
  it('sends the latest messages and the guest’s preferences, and returns the server’s answer', async () => {
    const bodies: unknown[] = []
    const turn = await ask(async (b) => { bodies.push(b); return served }, Array.from({ length: 30 }, (_, i) => user(`m${i}`, i)), { ...ctx, mobility: 'easy', likes: ['quiet mornings'] })
    expect(turn.reply).toEqual({ text: 'From the model.', citations: [{ label: 'Dining', path: '/plan/dining' }], source: 'claude' })
    const body = bodies[0] as { history: { text: string }[]; mobility: string; likes: string[] }
    expect(body.history).toHaveLength(12)
    expect(body.history[11].text).toBe('m29')
    expect(body).toMatchObject({ mobility: 'easy', likes: ['quiet mornings'] })
  })
  it('passes on the server’s own fallback and handoff', async () => {
    expect(await ask(async () => ({ text: 'Script.', citations: [], source: 'scripted', handoff: null, fallback: 'limit' }), [user('hi')], ctx)).toMatchObject({ fallback: 'limit', reply: { source: 'scripted' } })
  })
  it('answers on the device when the server cannot be reached or sends something unreadable', async () => {
    expect(await ask(async () => { throw new Error('offline') }, [user('where can we eat dinner')], ctx)).toMatchObject({ fallback: 'network', reply: { source: 'scripted' } })
    expect(await ask(async () => ({ nonsense: true }), [user('where can we eat dinner')], ctx)).toMatchObject({ fallback: 'bad', reply: { source: 'scripted' } })
  })
  it('reads only the agreed shape', () => {
    expect(normalizeTurn(null)).toBeNull()
    expect(normalizeTurn({ text: '', source: 'claude' })).toBeNull()
    expect(normalizeTurn({ text: 'x', source: 'other' })).toBeNull()
    expect(normalizeTurn({ text: '', source: 'handoff', handoff: 'nope' })).toBeNull()
    expect(normalizeTurn({ text: '', source: 'handoff', handoff: 'medical' })).toMatchObject({ handoff: 'medical' })
    expect(normalizeTurn({ text: 'x', source: 'claude', citations: [{ label: 'A', path: 'https://evil' }, { label: 'B', path: '/ok' }], fallback: 'weird' })).toMatchObject({ reply: { citations: [{ label: 'B', path: '/ok' }] }, fallback: null })
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

describe('build my day', () => {
  it('fits a tour to the ship’s day and gives a time to be back', () => {
    const plan = buildDay(REFERENCE_SAILING, 3, { ...NO_WISH, tours: ['water'] })
    const tour = plan.items.find((i) => i.kind === 'tour')!
    expect(tour.id).toBe('coz-snorkel')
    expect(plan.backBy).toBe('15:45')
    expect(plan.items.some((i) => i.kind === 'dinner')).toBe(true)
  })
  it('offers only level, wheelchair-friendly tours when asked', () => {
    const plan = buildDay(REFERENCE_SAILING, 4, { ...NO_WISH, mobility: 'wheelchair' })
    expect(plan.items.find((i) => i.kind === 'tour')?.id).toBe('bze-walk')
  })
  it('spreads a sea day and keeps adults-only events away from children', () => {
    const plan = buildDay(REFERENCE_SAILING, 2, { ...NO_WISH, withKids: true })
    expect(plan.items.filter((i) => i.kind === 'event').length).toBeGreaterThan(0)
    expect(plan.backBy).toBeNull()
    const starts = plan.items.map((i) => Number(i.start.slice(0, 2)) * 60 + Number(i.start.slice(3)))
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
  })
  it('is the same every time, and has no dinner on the last morning', () => {
    expect(buildDay(REFERENCE_SAILING, 5, NO_WISH)).toEqual(buildDay(REFERENCE_SAILING, 5, NO_WISH))
    expect(buildDay(REFERENCE_SAILING, 8, NO_WISH).items.some((i) => i.kind === 'dinner')).toBe(false)
    expect(buildDay(REFERENCE_SAILING, 9, NO_WISH).empty).toBe(true)
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
