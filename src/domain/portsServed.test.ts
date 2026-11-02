import { afterEach, describe, expect, it } from 'vitest'
import { applyPorts, normalizePorts } from './portsServed'
import { PORT_COORDS, PORT_GUIDES } from './ports'
import { PORT_KNOWLEDGE } from './portContent'

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const wire = (): Record<string, any> => ({ version: 'x1', guides: clone(PORT_GUIDES), knowledge: clone(PORT_KNOWLEDGE), coords: clone(PORT_COORDS) })

describe('normalizePorts', () => {
  it('reads the authored content as a good answer', () => {
    const p = normalizePorts(wire())!
    expect(Object.keys(p.guides)).toContain('belize')
    expect(p.knowledge.belize.fairPrices.length).toBeGreaterThan(0)
  })

  it.each([
    ['not an object', () => 3],
    ['a guide with the wrong id', () => { const w = wire(); w.guides.belize.id = 'roatan'; return w }],
    ['an unknown landing', () => { const w = wire(); w.guides.belize.landing = 'dock'; return w }],
    ['a fair price over its ceiling', () => { const w = wire(); w.knowledge.cozumel.fairPrices[0].car = 999; return w }],
    ['a missing guide port', () => { const w = wire(); delete w.guides.roatan; return w }],
    ['a missing knowledge entry', () => { const w = wire(); delete w.knowledge.belize; return w }],
    ['a missing coordinate', () => { const w = wire(); delete w.coords.cozumel; return w }],
    ['a coordinate out of range', () => { const w = wire(); w.coords.fll = [-200, 26]; return w }],
    ['a bad crowd level', () => { const w = wire(); w.knowledge.cozumel.dayPasses[0].crowd = 'packed'; return w }],
    ['an empty scam alert', () => { const w = wire(); w.knowledge.cozumel.scams = ['']; return w }],
  ])('rejects %s', (_n, make) => {
    expect(normalizePorts(make())).toBeNull()
  })
})

describe('applyPorts', () => {
  const saved = wire()
  afterEach(() => applyPorts(normalizePorts(saved)!))

  it('swaps the guides, knowledge and coordinates in place', () => {
    const guides = PORT_GUIDES
    const w = wire()
    w.guides.cozumel.blurb = 'A changed blurb.'
    w.knowledge.cozumel.taxiStand = 'A changed stand.'
    w.coords.cozumel = [-87, 20]
    applyPorts(normalizePorts(w)!)
    expect(PORT_GUIDES).toBe(guides)
    expect(PORT_GUIDES.cozumel.blurb).toBe('A changed blurb.')
    expect(PORT_KNOWLEDGE.cozumel.taxiStand).toBe('A changed stand.')
    expect(PORT_COORDS.cozumel).toEqual([-87, 20])
  })
})
