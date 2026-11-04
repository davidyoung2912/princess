// Writes the programme of the ships other than Sun Princess: `npm run shipprogrammes:gen`. The result is server/Princess.Api/Content/ship-programmes.json, which the server
// embeds and serves from GET /reference/ships/{id}/program. `src/domain/shipPrograms.test.ts` fails when the file is stale.
import { writeFileSync } from 'node:fs'
import { shipProgrammesFileText } from './ship-programme-data.ts'

writeFileSync(new URL('../server/Princess.Api/Content/ship-programmes.json', import.meta.url), shipProgrammesFileText())
console.log('wrote server/Princess.Api/Content/ship-programmes.json')
