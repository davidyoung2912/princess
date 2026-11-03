import { readFileSync } from 'node:fs'
import type { CatalogueSource } from './catalogue.ts'

const dir = new URL('../db/seed/catalogue/', import.meta.url)
const read = <T>(f: string) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as T

export const OUT = new URL('generated/catalogue.sql', dir)

export function loadCatalogue(): CatalogueSource {
  return {
    regions: read('regions.json'), ships: read('ships.json'), ports: read('ports.json'),
    patterns: read('patterns.json'), sailings: read('sailings-2027.json'), fares: read('fares.json'), categories: read('categories.json'),
  }
}
