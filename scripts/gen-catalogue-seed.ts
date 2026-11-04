// `npm run catalogue:gen`: validates db/seed/catalogue/*.json and writes db/seed/catalogue/generated/catalogue.sql.
import { writeFileSync } from 'node:fs'
import { renderCatalogueSql, validateCatalogue } from './catalogue.ts'
import { shipCabinRows } from './ship-cabin-rows.ts'
import { shipVenueRows } from './ship-venue-data.ts'
import { loadCatalogue, OUT } from './catalogue-io.ts'

const c = loadCatalogue()
const errors = validateCatalogue(c)
if (errors.length) {
  console.error(errors.map((e) => `  - ${e}`).join('\n'))
  process.exit(1)
}
writeFileSync(OUT, renderCatalogueSql(c, shipCabinRows(c), shipVenueRows(c)))
console.log(`catalogue:gen wrote ${c.sailings.length} sailings for ${c.ships.length} ships`)
