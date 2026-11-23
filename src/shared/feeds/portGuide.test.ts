import { describe, expect, it } from 'vitest'
import { byTier, directionsUrl, filterPorts, groupByCountry } from '../../domain/portGuide'
import { normalizePortGuide, normalizePortList } from './portGuide'

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

describe('port list', () => {
  const list = [
    { id: 'a', name: 'Cádiz, Spain', area: 'Spain', countryId: 'es', countryName: 'Spain', shortDescription: 'Oldest city' },
    { id: 'b', name: 'Nassau, Bahamas', area: 'Bahamas', countryId: 'bs', countryName: 'The Bahamas', shortDescription: 'Pirate history' },
  ]
  it('reads the list by name and drops unusable lines', () => {
    expect(normalizePortList({ ports: [{ id: 'b', name: 'Nassau' }, { id: 'a', name: 'Cádiz' }, { id: '', name: 'x' }] })?.map((p) => p.id)).toEqual(['a', 'b'])
    expect(normalizePortList({ ports: [] })).toBeNull()
    expect(normalizePortList(null)).toBeNull()
  })
  it('filters on every word, ignoring accents and case', () => {
    expect(filterPorts(list, 'cadiz').map((p) => p.id)).toEqual(['a'])
    expect(filterPorts(list, 'pirate bah').map((p) => p.id)).toEqual(['b'])
    expect(filterPorts(list, 'pirate spain')).toEqual([])
    expect(filterPorts(list, '  ')).toHaveLength(2)
  })
})

describe('groupByCountry', () => {
  const p = (id: string, name: string, countryId: string, countryName: string) => ({ id, name, area: '', countryId, countryName, shortDescription: '' })
  it('makes one group per country by name, ports by name within it, and a port with no country last', () => {
    const groups = groupByCountry([p('n', 'Nassau', 'bs', 'The Bahamas'), p('c', 'Cádiz', 'es', 'Spain'), p('x', 'Odd', '', ''), p('b', 'Barcelona', 'es', 'Spain'), p('f', 'Freeport', 'bs', 'The Bahamas')])
    expect(groups.map((g) => g.countryId)).toEqual(['es', 'bs', ''])
    expect(groups.map((g) => g.ports.map((x) => x.id))).toEqual([['b', 'c'], ['f', 'n'], ['x']])
  })
})
