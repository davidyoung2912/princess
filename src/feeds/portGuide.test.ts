import { describe, expect, it } from 'vitest'
import { byTier, directionsUrl } from '../domain/portGuide'
import { normalizePortGuide } from './portGuide'

describe('normalizePortGuide', () => {
  it('reads a guide and drops what is not usable', () => {
    const g = normalizePortGuide({
      id: 'nassau', name: 'Nassau, Bahamas', area: 'Bahamas', shortDescription: 's', longDescription: 'l',
      officialLinks: [{ label: 'Visit', url: 'https://example.com' }, { label: 'Bad', url: 'javascript:alert(1)' }],
      attractions: [{ name: 'Fort', tier: 'Walk-Off', logistics: [{ label: 'Travel', text: '5 min' }, { label: '', text: 'x' }], links: [], map: { lat: 25.1, lng: -77.3 } }, { tier: 'no name' }],
      tips: [{ title: 'Cash', text: 'Bring USD' }, { title: 'Empty', text: '' }],
      stats: { population: '~1', timeline: [{ when: '1492', text: 'Landing' }] },
    })
    expect(g?.officialLinks).toEqual([{ label: 'Visit', url: 'https://example.com' }])
    expect(g?.attractions).toHaveLength(1)
    expect(g?.attractions[0].logistics).toHaveLength(1)
    expect(g?.tips).toHaveLength(1)
    expect(g?.stats?.timeline).toEqual([{ when: '1492', text: 'Landing' }])
  })

  it('refuses an answer with no id or name', () => {
    expect(normalizePortGuide(null)).toBeNull()
    expect(normalizePortGuide({ id: 'x' })).toBeNull()
  })
})

describe('port guide helpers', () => {
  it('builds a directions link and groups by tier in first-seen order', () => {
    expect(directionsUrl({ lat: 1.5, lng: -2 })).toBe('https://www.google.com/maps/dir/?api=1&destination=1.5,-2')
    const a = (name: string, tier: string) => ({ name, aka: '', tier, logistics: [], why: '', links: [], map: null })
    expect(byTier([a('1', 'A'), a('2', 'B'), a('3', 'A')]).map((g) => [g.tier, g.items.length])).toEqual([['A', 2], ['B', 1]])
  })
})
