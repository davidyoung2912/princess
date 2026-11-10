import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  onboard: { today: vi.fn(), portDay: vi.fn(), muster: vi.fn(), emergency: vi.fn() },
  boarding: { pass: vi.fn() },
  plan: { dining: { view: vi.fn() } },
}))
vi.mock('../runtime', () => ({ api }))

import { awayPackStatus } from '../domain/awayFromShip'
import { cacheGet } from '../domain/offlineCache'
import { awayPackRunning, captureAwayPack, readAwayPack } from './awayPack'

class Fake {
  items = new Map<string, string>()
  get length() { return this.items.size }
  key(i: number) { return [...this.items.keys()][i] ?? null }
  getItem(k: string) { return this.items.get(k) ?? null }
  setItem(k: string, v: string) { this.items.set(k, v) }
  removeItem(k: string) { this.items.delete(k) }
}

const person = { id: 'p1', booker: 'b1' }
const any = (raw: unknown) => raw

describe('Away From Ship copy', () => {
  let store: Fake
  beforeEach(() => {
    store = new Fake()
    vi.stubGlobal('localStorage', store)
    for (const f of [api.onboard.today, api.onboard.portDay, api.onboard.muster, api.onboard.emergency, api.boarding.pass, api.plan.dining.view]) f.mockReset().mockResolvedValue({})
  })
  afterEach(() => vi.unstubAllGlobals())

  it('records every piece as missing when none arrives, and still records the attempt for the port day', async () => {
    for (const f of [api.onboard.today, api.onboard.portDay, api.onboard.muster, api.onboard.emergency, api.boarding.pass, api.plan.dining.view]) f.mockRejectedValue(new Error('offline'))
    const r = await captureAwayPack(person, '2027-03-05')
    expect(r?.items.every((i) => !i.ok)).toBe(true)
    expect(readAwayPack(person)?.date).toBe('2027-03-05')
    expect(awayPackStatus(readAwayPack(person), '2027-03-05').state).toBe('none')
    expect(awayPackRunning()).toBe(false)
  })

  it('treats an answer that does not check out as missing and keeps nothing for it', async () => {
    const r = await captureAwayPack(person, '2027-03-05')
    expect(r?.items.find((i) => i.kind === 'today')?.ok).toBe(false)
    expect(cacheGet(store, 'today', 'p1', any)).toBeNull()
  })

  it('keeps a valid answer under the key the screen reads, and leaves the others to the attempt record', async () => {
    api.onboard.portDay.mockResolvedValue(null)
    const r = await captureAwayPack(person, '2027-03-05')
    expect(r?.items.find((i) => i.kind === 'portDay')?.ok).toBe(true)
    expect(cacheGet(store, 'portDay', 'b1', any)?.value).toEqual({ view: null })
    expect(awayPackStatus(r, '2027-03-05')).toMatchObject({ state: 'partial', saved: 1 })
  })

  it('does nothing when a copy is already being made', async () => {
    const first = captureAwayPack(person, 'd')
    expect(awayPackRunning()).toBe(true)
    expect(await captureAwayPack(person, 'd')).toBeNull()
    await first
  })
})
