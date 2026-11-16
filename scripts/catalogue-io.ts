import { readFileSync } from 'node:fs'
import type { CatalogueSource, ShipFact, ShipSection } from './catalogue.ts'

const dir = new URL('../db/seed/catalogue/', import.meta.url)
const read = <T>(f: string) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as T

export const OUT = new URL('generated/catalogue.sql', dir)

export function loadCatalogue(): CatalogueSource {
  const details = read<Record<string, { facts?: ShipFact[]; sections?: ShipSection[] }>>('ship-details.json')
  return {
    regions: read('regions.json'), ships: read<CatalogueSource['ships']>('ships.json').map((s) => ({ ...s, ...details[s.id] })), ports: read('ports.json'),
    patterns: read('patterns.json'), sailings: read('sailings-2027.json'), fares: read('fares.json'), categories: read('categories.json'),
  }
}
