import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import ports from '../../db/seed/catalogue/ports.json'
import { normalizePorts } from './portsServed'
import { tippingNorm } from './delights'

/** The authored content in the server's `PortsReference.cs` (X0g): every Tier A port has a guide, every port but the home port has knowledge, and the served shape is the one the app reads. */
const cs = readFileSync(new URL('../../server/Princess.Api/Domain/PortsReference.cs', import.meta.url), 'utf8')
const json = JSON.parse(cs.slice(cs.indexOf('"""\n') + 4, cs.lastIndexOf('\n""";')))
const tierA = ((ports as { ports?: { id: string; tier: string }[] }).ports ?? (ports as unknown as { id: string; tier: string }[])).filter((p) => p.tier === 'A').map((p) => p.id)

describe('authored port guides (X0g)', () => {
  it('reads as the served shape', () => {
    expect(normalizePorts({ version: 'test', ...json })).not.toBeNull()
  })
  it('has a guide and coordinates for each Tier A port, and knowledge for each but the home port', () => {
    expect(tierA).toHaveLength(25)
    for (const id of tierA) {
      expect(json.guides[id], `guide ${id}`).toBeTruthy()
      expect(json.coords[id], `coords ${id}`).toBeTruthy()
      if (id !== 'fll') expect(json.knowledge[id], `knowledge ${id}`).toBeTruthy()
    }
  })
  it('uses each excursion, walk and day-pass id once', () => {
    const ids: string[] = []
    for (const g of Object.values<{ excursions: { id: string }[] }>(json.guides)) ids.push(...g.excursions.map((e) => e.id))
    for (const k of Object.values<{ walks: { id: string }[]; dayPasses: { id: string }[] }>(json.knowledge)) ids.push(...k.walks.map((w) => w.id), ...k.dayPasses.map((d) => d.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('has a tipping norm for every port with knowledge', () => {
    for (const id of Object.keys(json.knowledge)) expect(tippingNorm(id), id).toBeTruthy()
  })
})
