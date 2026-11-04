import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import ports from '../../db/seed/catalogue/ports.json'
import { normalizePorts } from './portsServed'
import { tippingNorm } from './delights'
import { PLAN_B, PLAN_B_TRIGGERS, planBFor } from './portPilot'

/** The authored content in the server's `PortsReference.cs` (X0g): every Tier A port has a guide, every port but the home port has knowledge, and the served shape is the one the app reads. */
const cs = readFileSync(new URL('../../server/Princess.Api/Domain/PortsReference.cs', import.meta.url), 'utf8')
const json = JSON.parse(cs.slice(cs.indexOf('"""\n') + 4, cs.lastIndexOf('\n""";')))
const all = (ports as { ports?: { id: string; tier: string }[] }).ports ?? (ports as unknown as { id: string; tier: string }[])
const tierA = all.filter((p) => p.tier === 'A').map((p) => p.id)
const tierB = all.filter((p) => p.tier === 'B').map((p) => p.id)

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
  it('builds a plan B (X0i) for every other port from its own walks and day passes', () => {
    const others = Object.keys(json.knowledge).filter((id) => !(id in PLAN_B))
    expect(others.length).toBeGreaterThan(10)
    for (const id of others) {
      const b = planBFor(id, json.knowledge[id], false)
      for (const trigger of PLAN_B_TRIGGERS) expect(b[trigger].detail.length, `${id} ${trigger}`).toBeGreaterThan(20)
      expect(b.rain.detail).toContain(json.knowledge[id].walks[0].name)
    }
  })
  it('has a short guide and coordinates for each Tier B port, with no knowledge and no invented prices (X0j)', () => {
    expect(tierB).toHaveLength(35)
    for (const id of tierB) {
      const g = json.guides[id]
      expect(g, `guide ${id}`).toBeTruthy()
      expect(json.coords[id], `coords ${id}`).toBeTruthy()
      expect(json.knowledge[id], `no knowledge ${id}`).toBeUndefined()
      expect(g.excursions, `no priced outings ${id}`).toEqual([])
      expect(g.doThis.length, `doThis ${id}`).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('authored ashore content served with the ports (X0l)', () => {
  it('is valid in the served shape and only names ports that have a guide', () => {
    const p = normalizePorts({ version: 'test', ...json })
    expect(p).not.toBeNull()
    for (const id of Object.keys(json.ashore)) expect(json.guides[id], id).toBeTruthy()
  })
  it('covers every Tier A port: the home port and the ports with knowledge', () => {
    const tierA = ['fll', ...Object.keys(json.knowledge)]
    expect(Object.keys(json.ashore).sort()).toEqual(tierA.sort())
  })
  it('gives every port with knowledge contacts, four plan B cards, entry papers and take-me-back words in its own language', () => {
    for (const [id, k] of Object.entries<any>(json.knowledge)) {
      const a = json.ashore[id]
      expect(a.contacts.emergency, id).toBeTruthy()
      expect(Object.keys(a.planB).sort(), id).toEqual(['energy', 'heat', 'rain', 'tender'])
      expect(a.clearance.country, id).toBeTruthy()
      if (k.lang) expect(a.takeMeBack.lang, id).toBe(k.lang)
      expect(a.takeMeBack.say, id).toBeTruthy()
    }
  })
  it('rejects a malformed plan B or entry row', () => {
    const bad = (mut: (a: Record<string, any>) => void) => { const c = JSON.parse(JSON.stringify(json)); mut(c.ashore); return normalizePorts({ version: 'test', ...c }) }
    expect(bad((a) => { delete a.cozumel.planB.rain })).toBeNull()
    expect(bad((a) => { a.belize.clearance.forms = 'none' })).toBeNull()
    expect(bad((a) => { a.nowhere = { contacts: a.cozumel.contacts } })).toBeNull()
  })
})
