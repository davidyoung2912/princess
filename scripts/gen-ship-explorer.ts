// Writes the Explorer content of every ship: `npm run shipexplorer:gen`. The result is server/Princess.Api/Content/ship-explorer.json, which the server embeds and serves
// through the Explorer endpoints. `src/features/explorer/domain/shipExplorer.test.ts` fails when the file is stale.
import { writeFileSync } from 'node:fs'
import { shipExplorerFileText } from './ship-explorer-data.ts'

writeFileSync(new URL('../server/Princess.Api/Content/ship-explorer.json', import.meta.url), shipExplorerFileText())
console.log('wrote server/Princess.Api/Content/ship-explorer.json')
