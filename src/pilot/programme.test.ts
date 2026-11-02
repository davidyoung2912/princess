import { describe, expect, it } from 'vitest'
import { applyToProgramme } from './programme'

describe('telling the account about the programme', () => {
  it('looks up the day, then sets each event, and carries on past a refusal', async () => {
    const calls: string[] = []
    const onboard = {
      program: async (d: number) => { calls.push(`day ${d}`); return {} as never },
      togglePlan: async (id: string, on: boolean) => { calls.push(`${id} ${on}`); if (id === 'a') throw new Error('forbidden'); return [] },
    }
    await applyToProgramme(onboard, 3, [{ eventId: 'a', on: false }, { eventId: 'b', on: true }])
    expect(calls).toEqual(['day 3', 'a false', 'b true'])
  })
  it('does nothing for no effects, and still tries the toggles when the day cannot be loaded', async () => {
    const calls: string[] = []
    const onboard = { program: async () => { throw new Error('offline') }, togglePlan: async (id: string) => { calls.push(id); return [] } }
    await applyToProgramme(onboard, 2, [])
    expect(calls).toEqual([])
    await applyToProgramme(onboard, 2, [{ eventId: 'x', on: true }])
    expect(calls).toEqual(['x'])
  })
})
