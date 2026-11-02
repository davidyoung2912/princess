import { describe, expect, it, vi } from 'vitest'

/**
 * The app holds no authored reference data, so on a cold start (before any table arrives) every module must still load. The setup file seeds the tables
 * for the other tests; here the modules are loaded afresh, unseeded, as the browser loads them.
 */
const modules = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../testing/**', '!../**/*.d.ts', '!../main.tsx'])

describe('a cold start', () => {
  it('loads every module with the reference tables still empty', async () => {
    vi.resetModules()
    const failures: string[] = []
    for (const [path, load] of Object.entries(modules)) {
      try { await load() } catch (e) { failures.push(`${path}: ${(e as Error).message.split('\n')[0]}`) }
    }
    expect(failures).toEqual([])
  }, 60_000)

  it('holds no authored fare tables', async () => {
    vi.resetModules()
    const [pricing, fares] = await Promise.all([import('../domain/pricing'), import('../domain/fares')])
    expect([Object.keys(pricing.INTERIOR_FARE).length, pricing.FUTURE_DEPARTURES.length, pricing.TAXES_AND_FEES, pricing.GRATUITY_PER_NIGHT]).toEqual([0, 0, 0, 0])
    expect(Object.values(fares.FARES).map((f) => f.name)).toEqual(['', '', ''])
  })

  it('holds no authored sailings, ports, excursions, dining rooms or port guides', async () => {
    vi.resetModules()
    const [sailings, excursions, dining, ports, portContent] = await Promise.all([
      import('../domain/sailings'), import('../domain/excursions'), import('../domain/dining'), import('../domain/ports'), import('../domain/portContent'),
    ])
    expect([sailings.SAILINGS.length, Object.keys(sailings.PORTS).length, excursions.EXCURSIONS.length, dining.VENUES.length]).toEqual([0, 0, 0, 0])
    expect([Object.keys(ports.PORT_GUIDES).length, Object.keys(ports.PORT_COORDS).length, Object.keys(portContent.PORT_KNOWLEDGE).length]).toEqual([0, 0, 0])
  })
})
