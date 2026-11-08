// @vitest-environment node
import { existsSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { allArtPaths, HERO_IDS, POSES } from './manifest'

describe('art manifest', () => {
  it('has a hero for every journey stage and sixteen poses', () => {
    expect(HERO_IDS).toHaveLength(11)
    expect(Object.keys(POSES)).toHaveLength(16)
  })
  it('has every file on disk within the weight budget', () => {
    for (const p of allArtPaths()) {
      const file = `src/assets/art/${p}`
      expect(existsSync(file), file).toBe(true)
      expect(statSync(file).size, file).toBeLessThan(105 * 1024)
    }
  })
})
