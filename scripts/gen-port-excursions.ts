// `npm run portexcursions:gen`: writes server/Princess.Api/Content/port-excursions.json from scripts/port-excursions-data.ts (docs/review-and-completeness-plan.md, Phase B).
import { writeFileSync } from 'node:fs'
import { portExcursions, portExcursionsFileText } from './port-excursions-data.ts'

writeFileSync(new URL('../server/Princess.Api/Content/port-excursions.json', import.meta.url), portExcursionsFileText())
console.log(`wrote server/Princess.Api/Content/port-excursions.json (${portExcursions().length} tours)`)
