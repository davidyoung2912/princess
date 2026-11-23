// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { guideProblems } from '../../domain/portGuide'
import { normalizePortGuide } from './portGuide'

const file = JSON.parse(readFileSync(new URL('../../../server/Princess.Api/Content/port-guides.json', import.meta.url), 'utf8')) as unknown[]
const catalogue = JSON.parse(readFileSync(new URL('../../../db/seed/catalogue/ports.json', import.meta.url), 'utf8')) as { id: string }[]

describe('the generated port guides the server embeds', () => {
  const guides = file.map((g) => normalizePortGuide(g))

  it('every entry reads, ids are unique and each is a catalogue port', () => {
    expect(guides.every((g) => g !== null)).toBe(true)
    const ids = guides.map((g) => g!.id)
    expect(new Set(ids).size).toBe(ids.length)
    const known = new Set(catalogue.map((p) => p.id))
    expect(ids.filter((id) => !known.has(id))).toEqual([])
  })

  it('every catalogue port has a guide', () => {
    const ids = new Set(guides.map((g) => g!.id))
    expect(catalogue.map((p) => p.id).filter((id) => !ids.has(id))).toEqual([])
  })

  it('no guide has a gap, a bad link or a bad map point', () => {
    expect(guides.flatMap((g) => guideProblems(g!))).toEqual([])
  })

  it('the reader drops nothing the file holds', () => {
    // A link or attraction lost in normalising means the file holds something the page would silently not show.
    file.forEach((raw, i) => {
      const r = raw as { attractions: unknown[]; tips: unknown[]; officialLinks: unknown[] }
      expect(guides[i]!.attractions).toHaveLength(r.attractions.length)
      expect(guides[i]!.tips).toHaveLength(r.tips.length)
      expect(guides[i]!.officialLinks).toHaveLength(r.officialLinks.length)
    })
  })
})

describe('guideProblems', () => {
  it('names what is missing', () => {
    const g = normalizePortGuide({ id: 'x', name: 'X', attractions: [{ name: 'A', tier: 't', why: 'w', logistics: [{ label: 'a', text: 'b' }], links: [{ label: 'l', url: 'http://insecure.example' }], map: { lat: 0, lng: 0 } }] })!
    const p = guideProblems(g)
    expect(p).toContain('x: no short description')
    expect(p).toContain('x: no tips')
    expect(p).toContain('x: attraction "A" has an impossible map point')
  })
})
