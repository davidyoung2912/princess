import { describe, expect, it } from 'vitest'
import { orderByRecent, parseRecents, pushRecent, RECENT_SENT_MAX } from './chatRecents'
import { BUNDLE_TYPES } from './chatBundles'
import { GAMES } from '../../games/domain/catalogue'
import { SHAREABLE_GAMES } from '../../games/domain/share'

describe('recently sent to', () => {
  it('puts the latest first, once each, and stays short', () => {
    expect(pushRecent(['a', 'b'], ['b', 'c'])).toEqual(['b', 'c', 'a'])
    expect(pushRecent(Array.from({ length: 20 }, (_, i) => `x${i}`), ['n'])).toHaveLength(RECENT_SENT_MAX)
  })
  it('orders recent chats first and keeps the rest in place', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    expect(orderByRecent(rows, ['c', 'a']).map((r) => r.id)).toEqual(['c', 'a', 'b', 'd'])
    expect(orderByRecent(rows, []).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('ignores bad saved data', () => {
    expect(parseRecents('nonsense')).toEqual([])
    expect(parseRecents('{"a":1}')).toEqual([])
    expect(parseRecents('["a",3,"b"]')).toEqual(['a', 'b'])
    expect(parseRecents(null)).toEqual([])
  })
})

describe('release gates: bundles', () => {
  it('every bundle type has a label, a family and a code kind', () => {
    for (const [type, def] of Object.entries(BUNDLE_TYPES)) {
      expect(def.label, type).toMatch(/^bundle\.type\./)
      expect(def.family, type).toBeTruthy()
      expect(['direct', 'handoff'], type).toContain(def.qr)
    }
  })
  it('every game that can be played alone has a bundle adapter', () => {
    for (const id of SHAREABLE_GAMES) expect(BUNDLE_TYPES[`game.${id}`], id).toBeDefined()
    const alone = GAMES.filter((g) => g.mode === 'single').map((g) => g.id).filter((id) => (SHAREABLE_GAMES as readonly string[]).includes(id) === false)
    expect(alone).toEqual([])
  })
})
