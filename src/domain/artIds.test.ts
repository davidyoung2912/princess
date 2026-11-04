import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { artManifest, portArt, regionArt, shipArt } from './artIds'

const seed = (name: string) => JSON.parse(readFileSync(join(process.cwd(), 'db/seed/catalogue', `${name}.json`), 'utf8'))

describe('placeholder art ids', () => {
  it('names a picture for a ship, a region and a port', () => {
    expect(shipArt('sun-princess')).toEqual({ id: 'ship.sun-princess', kind: 'ship' })
    expect(regionArt('caribbean')).toEqual({ id: 'region.caribbean', kind: 'region' })
    expect(portArt('cozumel', 'A')).toEqual({ id: 'port.cozumel', kind: 'postcard' })
    expect(portArt('nassau', 'B', 'caribbean')).toEqual({ id: 'region.caribbean', kind: 'regionScene' })
    expect(portArt('nowhere', 'C')).toEqual({ id: 'region.generic', kind: 'regionScene' })
  })

  it('covers every ship, region and Tier A port of the catalogue, once each', () => {
    const ships = seed('ships'), regions = seed('regions'), ports = seed('ports')
    const manifest = artManifest({ ships, regions, ports })
    const tierA = ports.filter((p: { tier: string }) => p.tier === 'A').length
    expect(manifest).toHaveLength(ships.length + regions.length + tierA)
    expect(new Set(manifest.map((m) => m.id)).size).toBe(manifest.length)
    expect(tierA).toBe(25)
  })
})
