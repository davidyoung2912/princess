// `npm run catalogue:check`: the catalogue JSON is consistent and the generated SQL on disk matches it.
import { readFileSync } from 'node:fs'
import { renderCatalogueSql, validateCatalogue } from './catalogue.ts'
import { shipCabinRows } from './ship-cabin-rows.ts'
import { shipVenueRows } from './ship-venue-data.ts'
import { loadCatalogue, OUT } from './catalogue-io.ts'

const c = loadCatalogue()
const errors = validateCatalogue(c)
let disk = ''
try { disk = readFileSync(OUT, 'utf8') } catch { errors.push('generated/catalogue.sql is missing; run `npm run catalogue:gen`') }
if (disk && disk !== renderCatalogueSql(c, shipCabinRows(c), shipVenueRows(c))) errors.push('generated/catalogue.sql is stale; run `npm run catalogue:gen`')
if (errors.length) {
  console.error(errors.map((e) => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log(`catalogue:check ok (${c.ships.length} ships, ${c.sailings.length} sailings)`)
