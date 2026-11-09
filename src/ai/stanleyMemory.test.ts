import { describe, expect, it } from 'vitest'
import { STANLEY_LEVELS } from '../settings/settings'
import { levelOfProactivity, noticedItems, noticedMobility, toldRequest, normalizeItem, normalizeMemory, PROACTIVITY, proactivityOfLevel, tripItems, type MemoryItem } from './stanleyMemory'

const item = (o: Partial<MemoryItem> = {}): MemoryItem => ({ id: 'a', kind: 'pace', value: 'relaxed', text: 'You like a relaxed pace', reason: 'You asked Stanley to remember this.', scope: 'future', sailingId: null, sensitive: false, shared: true, updatedAt: 1, ...o })

describe('reading the server memory', () => {
  it('keeps a well formed item and drops one without an id, a scope or words', () => {
    expect(normalizeItem(item())).toEqual(item())
    expect(normalizeItem({ ...item(), id: '' })).toBeNull()
    expect(normalizeItem({ ...item(), scope: 'always' })).toBeNull()
    expect(normalizeItem({ ...item(), text: '' })).toBeNull()
    expect(normalizeItem(null)).toBeNull()
  })

  it('treats memory as on unless the server says it is off, and never throws on junk', () => {
    expect(normalizeMemory(undefined).enabled).toBe(true)
    expect(normalizeMemory({ enabled: false, items: [item(), { nope: 1 }], kinds: [{ kind: 'pace', values: ['relaxed'], multiple: false, sensitive: false }, 5] })).toMatchObject({ enabled: false, kinds: [{ kind: 'pace' }] })
    expect(normalizeMemory({ items: [item(), { nope: 1 }] }).items).toHaveLength(1)
  })
})

describe('what the device has noticed', () => {
  const inf = (id: string) => ({ id, source: 'pace' as const, text: id })
  it('offers pace, wake, interests and the quiet quiz answer, and never mobility', () => {
    const list = noticedItems([inf('pace:relaxed'), inf('rhythm:late'), inf('pasted:likes the water'), inf('quiz:quiet'), inf('quiz:mobility'), inf('quiz:budget')], [])
    expect(list.map((x) => `${x.request.kind}:${x.request.value}`)).toEqual(['pace:relaxed', 'wake:late', 'interest:water', 'interest:slow'])
  })
  it('does not offer what the server already holds or the same thing twice', () => {
    const list = noticedItems([inf('pace:relaxed'), inf('quiz:quiet'), inf('pasted:likes to slow down')], [item()])
    expect(list.map((x) => x.request.value)).toEqual(['slow'])
  })
})

describe('the carry-forward chooser', () => {
  it('lists only this trip’s items', () => {
    const items = [item({ id: '1', scope: 'trip', sailingId: 'S1' }), item({ id: '2', scope: 'trip', sailingId: 'S2' }), item({ id: '3' })]
    expect(tripItems(items, 'S1').map((i) => i.id)).toEqual(['1'])
  })
})

describe('proactivity layered over the four levels', () => {
  it('maps each plain choice to a level and back, and Off belongs to no choice', () => {
    for (const p of PROACTIVITY) expect(proactivityOfLevel(levelOfProactivity(p))).toBe(p)
    expect(PROACTIVITY.map(levelOfProactivity)).toEqual(['asked', 'helpful', 'chatty'])
    expect(proactivityOfLevel('off')).toBeNull()
  })
  it('leaves the four levels as they were', () => {
    expect([...STANLEY_LEVELS]).toEqual(['chatty', 'helpful', 'asked', 'off'])
  })
})

describe('mobility and typed-in preferences', () => {
  it('offers a mobility need with its switch off, and nothing for none or one already kept', () => {
    expect(noticedMobility('wheelchair', [])).toEqual({ kind: 'mobility', value: 'wheelchair', source: 'plan', share: false })
    expect(noticedMobility('any', [])).toBeNull()
    expect(noticedMobility('easy', [item({ kind: 'mobility', value: 'easy' })])).toBeNull()
  })
  const kinds = [{ kind: 'pace', values: ['relaxed', 'full'], multiple: false, sensitive: false }, { kind: 'diet', values: ['vegan'], multiple: true, sensitive: true }]
  it('builds a request only from a kind and value the server offered', () => {
    expect(toldRequest(kinds, 'pace', 'full', 'trip', 'S1')).toEqual({ kind: 'pace', value: 'full', scope: 'trip', sailingId: 'S1', source: 'told' })
    expect(toldRequest(kinds, 'pace', 'full', 'future', 'S1')).toEqual({ kind: 'pace', value: 'full', scope: 'future', source: 'told' })
    expect(toldRequest(kinds, 'pace', 'sprint', 'future', '')).toBeNull()
    expect(toldRequest(kinds, 'colour', 'blue', 'future', '')).toBeNull()
  })
  it('starts a sensitive kind with its switch off unless the guest turned it on', () => {
    expect(toldRequest(kinds, 'diet', 'vegan', 'future', '')?.share).toBe(false)
    expect(toldRequest(kinds, 'diet', 'vegan', 'future', '', true)?.share).toBe(true)
  })
})
