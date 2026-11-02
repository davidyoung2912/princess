import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../domain/scenarios'

describe('scenario ids', () => {
  it('are the same on the server (DemoRules.ScenarioIds) and in the demo controls', () => {
    const cs = readFileSync('server/Princess.Api/Domain/DemoRules.cs', 'utf8')
    const list = /ScenarioIds = new HashSet<string> \{([^}]*)\}/.exec(cs)?.[1] ?? ''
    const server = [...list.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]).sort()
    expect(server.length).toBeGreaterThan(0)
    expect(server).toEqual(SCENARIOS.map((s) => s.id).sort())
  })
})
