import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../data/store'
import { buildDay, NO_WISH } from '../domain/day'
import { buildRecap, recapText } from '../domain/recap'
import { REFERENCE_SAILING } from '../domain/sailings'
import { ask, askProblem, configFrom } from './concierge'
import { askClaude, ConciergeError, DEFAULT_MODEL, systemPrompt } from './client'
import { HOURLY_LIMIT, HOUR_MS, MAX_MESSAGE, screen, withinLimit } from './guard'
import { clearThread, KEEP, loadThread, saveThread } from './history'
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
  it('limits questions per hour and says when more are allowed', () => {
    const now = 10 * HOUR_MS
    const times = Array.from({ length: HOURLY_LIMIT }, (_, i) => now - 1000 * (i + 1))
    expect(withinLimit(times.slice(1), now).ok).toBe(true)
    const r = withinLimit(times, now)
    expect(r.ok).toBe(false)
    expect(r.retryAt).toBe(times[times.length - 1] + HOUR_MS)
    expect(withinLimit(times.map((t) => t - HOUR_MS), now).ok).toBe(true)
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

describe('Claude client', () => {
  const replyWith = (...bodies: unknown[]) => {
    const calls: { body: Record<string, unknown>; headers: Record<string, string> }[] = []
    const fetch = (async (_url: string, init: RequestInit) => {
      calls.push({ body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> })
      const body = bodies.shift()
      return typeof body === 'number' ? new Response('{}', { status: body }) : new Response(JSON.stringify(body), { status: 200 })
    }) as unknown as typeof globalThis.fetch
    return { fetch, calls }
  }
  const config = (fetch: typeof globalThis.fetch) => ({ apiKey: 'k', model: 'm', fetch })

  it('runs the tools the model asks for, then returns its answer with citations', async () => {
    const { fetch, calls } = replyWith(
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'get_port', input: { port: 'cozumel' } }] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Cozumel is a pier port.' }] },
    )
    const r = await askClaude(config(fetch), [user('tell me about Cozumel')], ctx)
    expect(r).toMatchObject({ text: 'Cozumel is a pier port.', source: 'claude' })
    expect(r.citations.map((c) => c.path)).toEqual(['/home/ports/cozumel'])
    expect(calls).toHaveLength(2)
    expect(calls[0].headers['x-api-key']).toBe('k')
    const second = calls[1].body.messages as { role: string; content: { type: string; tool_use_id?: string }[] }[]
    expect(second[second.length - 1].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1' })
    expect((calls[0].body.tools as unknown[]).length).toBe(TOOLS.length)
  })
  it('maps failures to codes', async () => {
    for (const [status, code] of [[401, 'auth'], [429, 'rate'], [500, 'bad']] as const) {
      await expect(askClaude(config(replyWith(status).fetch), [user('hi')], ctx)).rejects.toMatchObject({ code })
    }
    const down = (async () => { throw new TypeError('offline') }) as unknown as typeof globalThis.fetch
    await expect(askClaude(config(down), [user('hi')], ctx)).rejects.toBeInstanceOf(ConciergeError)
  })
  it('gives up when the model keeps calling tools', async () => {
    const loop = { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't', name: 'list_restaurants', input: {} }] }
    await expect(askClaude(config(replyWith(loop, loop, loop, loop, loop, loop).fetch), [user('hi')], ctx)).rejects.toMatchObject({ code: 'bad' })
  })
  it('sends only the latest messages, and tells the model the rules', async () => {
    const { fetch, calls } = replyWith({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] })
    await askClaude(config(fetch), Array.from({ length: 30 }, (_, i) => user(`m${i}`, i)), ctx)
    expect((calls[0].body.messages as unknown[]).length).toBe(12)
    expect(String(calls[0].body.system)).toContain('cannot book')
    expect(systemPrompt(ctx)).toContain('Daniel Harper')
  })
})

describe('ask', () => {
  const fail = (async () => new Response('{}', { status: 500 })) as unknown as typeof globalThis.fetch
  const good = (async () => new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'From the model.' }] }), { status: 200 })) as unknown as typeof globalThis.fetch

  it('never sends a handoff message to the model', async () => {
    let called = false
    const spy = (async () => { called = true; return good(''); }) as unknown as typeof globalThis.fetch
    const turn = await ask({ apiKey: 'k', model: 'm', fetch: spy }, [user('he is unconscious')], [], ctx)
    expect(turn.handoff).toBe('emergency')
    expect(called).toBe(false)
  })
  it('uses the scripted helper with no key', async () => {
    const turn = await ask(null, [user('where can we eat dinner')], [], ctx)
    expect(turn.reply.source).toBe('scripted')
    expect(turn.fallback).toBeNull()
  })
  it('uses the model when it answers, and falls back to the script when it fails or the limit is reached', async () => {
    expect((await ask({ apiKey: 'k', model: 'm', fetch: good }, [user('hi')], [], ctx)).reply.text).toBe('From the model.')
    expect(await ask({ apiKey: 'k', model: 'm', fetch: fail }, [user('where can we eat dinner')], [], ctx)).toMatchObject({ fallback: 'bad', reply: { source: 'scripted' } })
    const many = Array.from({ length: HOURLY_LIMIT }, () => ctx.now - 1000)
    expect(await ask({ apiKey: 'k', model: 'm', fetch: good }, [user('where can we eat dinner')], many, ctx)).toMatchObject({ fallback: 'limit', reply: { source: 'scripted' } })
  })
  it('reads the key and model from the build settings', () => {
    expect(configFrom({})).toBeNull()
    expect(configFrom({ VITE_ANTHROPIC_API_KEY: '  ' })).toBeNull()
    expect(configFrom({ VITE_ANTHROPIC_API_KEY: 'sk-x' })).toEqual({ apiKey: 'sk-x', model: DEFAULT_MODEL })
    expect(configFrom({ VITE_ANTHROPIC_API_KEY: 'sk-x', VITE_ANTHROPIC_MODEL: 'other' })?.model).toBe('other')
  })
})

describe('history', () => {
  it('keeps a thread per person, trims it, and clears it', async () => {
    const store = createMemoryStore()
    expect(await loadThread(store, 'daniel')).toEqual([])
    await saveThread(store, 'daniel', Array.from({ length: KEEP + 5 }, (_, i) => user(`m${i}`, i)), 1)
    await saveThread(store, 'priya', [user('hi')], 1)
    expect(await loadThread(store, 'daniel')).toHaveLength(KEEP)
    expect((await loadThread(store, 'daniel'))[KEEP - 1].text).toBe(`m${KEEP + 4}`)
    await clearThread(store, 'daniel')
    expect(await loadThread(store, 'daniel')).toEqual([])
    expect(await loadThread(store, 'priya')).toHaveLength(1)
  })
  it('ignores damaged records', async () => {
    const store = createMemoryStore()
    await store.put({ kind: 'concierge', owner: 'a', id: 'thread', updatedAt: 1, data: { messages: [1, { role: 'user', text: 'ok', at: 1, id: 'x' }, { role: 'system' }] } })
    expect(await loadThread(store, 'a')).toHaveLength(1)
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
