// Writes the served reference content: `npm run content:gen`. The arrays and records the domain modules register (src/domain/content.ts) become
// server/Princess.Api/Content/reference-content.json, which the server embeds and serves from GET /reference/content. `src/domain/contentServed.test.ts`
// fails when the file is stale.
import { writeFileSync } from 'node:fs'
import '../src/domain/contentServed.ts'
import { contentFileText } from '../src/domain/content.ts'

writeFileSync(new URL('../server/Princess.Api/Content/reference-content.json', import.meta.url), contentFileText())
console.log('wrote server/Princess.Api/Content/reference-content.json')
