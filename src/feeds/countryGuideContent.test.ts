// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { countryProblems } from '../domain/countryGuide'
import { normalizeCountryGuide } from './countryGuide'

const file = JSON.parse(readFileSync(new URL('../../server/Princess.Api/Content/country-guides.json', import.meta.url), 'utf8')) as unknown[]
const ports = JSON.parse(readFileSync(new URL('../../server/Princess.Api/Content/port-guides.json', import.meta.url), 'utf8')) as { id: string; countryId: string; countryName: string }[]
const guides = file.map((g) => normalizeCountryGuide(g))

describe('the generated country guides the server embeds', () => {
  it('has 35 profiles that read, with unique ids', () => {
    expect(guides.every((g) => g !== null)).toBe(true)
    expect(new Set(guides.map((g) => g!.id)).size).toBe(35)
  })

  it('has no gap, bad link or missing section', () => {
    expect(guides.flatMap((g) => countryProblems(g!))).toEqual([])
  })

  it('has a flag file for every profile', () => {
    const missing = guides.filter((g) => !existsSync(new URL(`../assets/art/flags/${g!.id}.png`, import.meta.url))).map((g) => g!.id)
    expect(missing).toEqual([])
  })

  it('is what every port guide points at, and lists that port', () => {
    const byId = new Map(guides.map((g) => [g!.id, g!]))
    for (const p of ports) {
      const c = byId.get(p.countryId)
      expect(c, `${p.id} -> ${p.countryId}`).toBeDefined()
      expect(c!.ports.map((x) => x.id)).toContain(p.id)
      expect(p.countryName).toBe(c!.name)
    }
  })

  it('labels the territories and no sovereign state as one', () => {
    const status = (id: string) => guides.find((g) => g!.id === id)!.status
    for (const id of ['pr', 'tc', 'hk', 'tw']) expect(status(id)).not.toBe('')
    expect(status('mx')).toBe('')
  })
})

describe('normalizeCountryGuide', () => {
  it('drops what is not usable and refuses an answer with no code or name', () => {
    expect(normalizeCountryGuide(null)).toBeNull()
    expect(normalizeCountryGuide({ id: 'Mexico', name: 'x' })).toBeNull()
    const g = normalizeCountryGuide({ id: 'mx', name: 'Mexico', links: [{ label: 'A', url: 'https://a.example' }, { label: 'B', url: 'javascript:1' }], ports: [{ id: 'cozumel', name: 'Cozumel' }, { id: '' }] })
    expect(g?.links).toHaveLength(1)
    expect(g?.ports).toHaveLength(1)
  })
})
