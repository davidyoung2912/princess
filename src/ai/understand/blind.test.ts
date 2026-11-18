import { describe, expect, it } from 'vitest'
import { HELDOUT_BLIND } from './corpus/heldoutBlind'
import { HELDOUT_FRESH } from './corpus/heldoutFresh'
import { SCREEN_SPECS } from './screenSpec'
import { understand } from './understand'

const read = (text: string) => understand(text, {}, (d) => d)

/**
 * First scores (2026-11-17): the blind set 0.185 before `screenSpecMore.ts` and 0.920 after it (tuned on its misses, so a regression guard); the fresh set, written after the widening, 0.520 on its first run, which is the honest measure of
 * how the long tail reads wording it was not built from. Its gate is that first score; raise it only when a new, untouched set measures higher.
 */
describe('the blind long tail set', () => {
  it('has three questions for every long tail topic and no topic that does not exist', () => {
    for (const s of SCREEN_SPECS) expect(HELDOUT_BLIND[s.id]?.split('|').length, s.id).toBe(3)
    for (const id of Object.keys(HELDOUT_BLIND)) expect(SCREEN_SPECS.some((s) => s.id === id), id).toBe(true)
  })

  it('reads wording written without the nouns open (tuned, a regression guard)', () => {
    let total = 0
    let hit = 0
    const misses: string[] = []
    for (const [topic, v] of Object.entries(HELDOUT_BLIND)) for (const p of v.split('|')) {
      total++
      const u = read(p)
      const ok = (u.outcome === 'confident' && u.topics[0]?.id === topic) ? 1 : (u.outcome === 'ambiguous' && u.topics.slice(0, 2).some((t) => t.id === topic)) ? 0.5 : 0
      hit += ok
      if (ok === 0) misses.push(`${topic} <= "${p}" -> ${u.outcome} ${u.topics.map((t) => t.id).join(',')}`)
    }
    expect(hit / total, `${(hit / total).toFixed(3)} of ${total}\n${misses.join('\n')}`).toBeGreaterThanOrEqual(0.9)
  })

  it('reads a fresh set written after the widening (the honest measure)', () => {
    let hit = 0
    const misses: string[] = []
    for (const [topic, p] of Object.entries(HELDOUT_FRESH)) {
      const u = read(p)
      const ok = (u.outcome === 'confident' && u.topics[0]?.id === topic) ? 1 : (u.outcome === 'ambiguous' && u.topics.slice(0, 2).some((t) => t.id === topic)) ? 0.5 : 0
      hit += ok
      if (ok === 0) misses.push(`${topic} <= "${p}" -> ${u.outcome} ${u.topics.map((t) => t.id).join(',')}`)
    }
    const total = Object.keys(HELDOUT_FRESH).length
    expect(hit / total, `${(hit / total).toFixed(3)} of ${total}\n${misses.join('\n')}`).toBeGreaterThanOrEqual(0.5)
  })
})
