import { afterEach, describe, expect, it } from 'vitest'
import { activateDeck, activeShip, clearPlans, keepPlan, loadAboardPlan, normalizeAboardPlan, planOf, setPlanLoader } from './aboardPlans'
import { ELEVATORS, MUSTER_STATIONS, PLACES, placeById } from './deck'

const raw = (shipId: string, over: Record<string, unknown> = {}) => ({
  version: `v-${shipId}`,
  shipId,
  accessibility: ['A note'],
  places: [
    { id: 'piazza', name: `${shipId} Piazza`, deck: 5, section: 'midship', kind: 'show', stepFree: true },
    { id: 'theatre', name: 'Theatre', deck: 6, section: 'forward', kind: 'show', stepFree: true, note: null },
  ],
  elevators: [{ bank: 'A', section: 'forward', side: 'port' }],
  muster: [{ letter: 'A', name: 'Theatre, port side', placeId: 'theatre', deck: 6 }],
  ...over,
})

afterEach(() => { clearPlans(); setPlanLoader(null) })

describe('a ship\'s deck plan', () => {
  it('reads the server\'s answer, all or nothing', () => {
    expect(normalizeAboardPlan(raw('sky-princess'))?.places).toHaveLength(2)
    expect(normalizeAboardPlan(raw('sky-princess', { places: [] }))).toBeNull()
    expect(normalizeAboardPlan(raw('sky-princess', { muster: [{ letter: 'A', name: 'x', placeId: 'nowhere', deck: 6 }] }))).toBeNull()
    expect(normalizeAboardPlan(raw('sky-princess', { places: [...raw('x').places, raw('x').places[0]] }))).toBeNull()
    expect(normalizeAboardPlan({ ...raw('sky-princess'), shipId: '' })).toBeNull()
    expect(normalizeAboardPlan(null)).toBeNull()
  })

  it('puts the plan of the ship in use where the screens read it', () => {
    keepPlan(normalizeAboardPlan(raw('sun-princess'))!)
    expect(activeShip()).toBe('sun-princess')
    expect(placeById('piazza')?.name).toBe('sun-princess Piazza')
    keepPlan(normalizeAboardPlan(raw('sky-princess'))!)
    expect(placeById('piazza')?.name).toBe('sun-princess Piazza')
    expect(activateDeck('sky-princess')).toBe(true)
    expect(placeById('piazza')?.name).toBe('sky-princess Piazza')
    expect(PLACES).toHaveLength(2)
    expect(ELEVATORS).toHaveLength(1)
    expect(MUSTER_STATIONS.A?.placeId).toBe('theatre')
    expect(activateDeck('sun-princess')).toBe(true)
    expect(placeById('piazza')?.name).toBe('sun-princess Piazza')
  })

  it('leaves the plan in use alone when the ship\'s is not loaded', () => {
    keepPlan(normalizeAboardPlan(raw('sun-princess'))!)
    expect(activateDeck('sapphire-princess')).toBe(false)
    expect(activeShip()).toBe('sun-princess')
  })

  it('loads a plan once, and keeps it', async () => {
    let calls = 0
    setPlanLoader(async (id) => { calls++; return raw(id) })
    expect(await loadAboardPlan('sapphire-princess')).toBe(true)
    expect(await loadAboardPlan('sapphire-princess')).toBe(true)
    expect(calls).toBe(1)
    expect(planOf('sapphire-princess')?.version).toBe('v-sapphire-princess')
  })

  it('refuses an answer for another ship, a bad answer and a failing loader', async () => {
    setPlanLoader(async () => raw('sky-princess'))
    expect(await loadAboardPlan('sapphire-princess')).toBe(false)
    setPlanLoader(async () => ({ nonsense: true }))
    expect(await loadAboardPlan('x-princess')).toBe(false)
    setPlanLoader(async () => { throw new Error('offline') })
    expect(await loadAboardPlan('y-princess')).toBe(false)
    expect(planOf('sapphire-princess')).toBeUndefined()
  })
})
