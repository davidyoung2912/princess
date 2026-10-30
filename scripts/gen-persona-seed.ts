// Writes db/seed/personas/*.sql and the persona catalogue: `npm run db:persona:gen`.
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildFiles, catalogue, runAll } from './persona-seed.ts'

const dir = new URL('../db/seed/personas/', import.meta.url)
mkdirSync(dir, { recursive: true })
const files = buildFiles()
for (const [name, sql] of Object.entries(files)) writeFileSync(new URL(`${name}.sql`, dir), sql)
writeFileSync(new URL('run-all.sql', dir), runAll())
writeFileSync(new URL('README.md', dir), catalogue())
console.log(`${Object.keys(files).length} files written`)
