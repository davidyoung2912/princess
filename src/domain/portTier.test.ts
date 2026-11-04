import { beforeEach, describe, expect, it } from 'vitest'
import { CATALOGUE_PORTS } from './sailings'
import { PORT_KNOWLEDGE, type PortKnowledge } from './portContent'
import { guideLevelOf, guidePickerPorts, portFacts, shortSnapshot } from './portTier'

const k = { taxiStand: 'x' } as PortKnowledge
const port = (id: string, extra: object = {}) => { CATALOGUE_PORTS[id] = { id, name: id, zone: 'UTC', tender: false, ...extra } }

describe('portTier (X0g)', () => {
  beforeEach(() => {
    for (const id of Object.keys(CATALOGUE_PORTS)) delete CATALOGUE_PORTS[id]
    for (const id of Object.keys(PORT_KNOWLEDGE)) delete (PORT_KNOWLEDGE as Record<string, unknown>)[id]
  })

  it('levels follow what is written', () => {
    port('a1'); port('b1', { tier: 'B' }); port('c1', { tier: 'C' })
    ;(PORT_KNOWLEDGE as Record<string, PortKnowledge>).a1 = k
    expect(guideLevelOf('a1')).toBe('full')
    expect(guideLevelOf('b1')).toBe('short')
    expect(guideLevelOf('c1')).toBe('link')
    expect(guideLevelOf('nowhere')).toBe('link')
  })

  it('facts come only from the catalogue', () => {
    port('p', { country: 'Spain', currency: 'EUR', languages: ['es', 'ca'], tender: true })
    expect(portFacts('p')).toEqual([
      { label: 'country', value: 'Spain' }, { label: 'currency', value: 'EUR' }, { label: 'languages', value: 'es, ca' }, { label: 'landing', value: 'tender' },
    ])
    expect(portFacts('nowhere')).toEqual([])
  })

  it('the picker lists the sailing\'s ports once, skips sea and unknown ports, then adds full guides', () => {
    port('x'); port('y'); port('z')
    ;(PORT_KNOWLEDGE as Record<string, PortKnowledge>).z = k
    expect(guidePickerPorts(['x', 'sea', 'y', 'x', 'ghost'])).toEqual(['x', 'y', 'z'])
  })

  it('the short snapshot invents nothing', () => {
    port('b1', { country: 'Italy' })
    const lines = shortSnapshot('b1')
    expect(lines[0]).toBe('Country: Italy')
    expect(lines.at(-1)).toMatch(/not written/)
    expect(shortSnapshot('nowhere')).toEqual([])
  })
})
