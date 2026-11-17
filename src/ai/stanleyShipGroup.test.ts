import { describe, expect, it } from 'vitest'
import { normalizeShipGroup } from './stanleyShipGroup'

const f = (id: string, severity: string, route = '/plan/away') => ({ id, severity, title: 'T', detail: 'D', route })

describe('normalizeShipGroup', () => {
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizeShipGroup(null)).toBeNull()
    expect(normalizeShipGroup({ findings: [] })).toBeNull()
  })
  it('puts the most urgent first and keeps the server order within a level', () => {
    const r = normalizeShipGroup({ hasTrip: true, findings: [f('a', 'ok'), f('b', 'soon'), f('c', 'critical'), f('d', 'soon')], notChecked: [], clear: false })!
    expect(r.findings.map((x) => x.id)).toEqual(['c', 'b', 'd', 'a'])
  })
  it('drops findings with an unknown severity or an outside route', () => {
    const r = normalizeShipGroup({ hasTrip: true, findings: [f('a', 'weird'), f('b', 'ok', '//evil.example'), f('c', 'ok', 'https://x'), f('d', 'ok')], clear: true })!
    expect(r.findings.map((x) => x.id)).toEqual(['d'])
  })
  it('is only clear when nothing needs attention', () => {
    expect(normalizeShipGroup({ hasTrip: true, findings: [f('a', 'critical')], clear: true })!.clear).toBe(false)
    expect(normalizeShipGroup({ hasTrip: true, findings: [f('a', 'ok')], clear: true })!.clear).toBe(true)
  })
})
