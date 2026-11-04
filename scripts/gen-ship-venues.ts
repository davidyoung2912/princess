// Writes the dining of the ships other than Sun Princess: `npm run shipvenues:gen`. The result is server/Princess.Api/Content/ship-venues.json, which the server
// embeds and serves from GET /reference/ships/{id}/venues. `src/domain/shipVenues.test.ts` fails when the file is stale.
import { writeFileSync } from 'node:fs'
import { shipVenuesFileText } from './ship-venue-data.ts'

writeFileSync(new URL('../server/Princess.Api/Content/ship-venues.json', import.meta.url), shipVenuesFileText())
console.log('wrote server/Princess.Api/Content/ship-venues.json')
