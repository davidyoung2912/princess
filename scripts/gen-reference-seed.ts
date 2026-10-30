// Writes db/seed/reference/*.sql from the TypeScript fixtures: `npm run db:seed:gen`.
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildTables, FILE_TITLES, renderFile } from './reference-seed.ts'

const dir = new URL('../db/seed/reference/', import.meta.url)
mkdirSync(dir, { recursive: true })
const tables = buildTables()
for (const file of Object.keys(FILE_TITLES)) {
  writeFileSync(new URL(`${file}.sql`, dir), renderFile(file, tables))
}
console.log(`${Object.keys(FILE_TITLES).length} files, ${tables.length} tables, ${tables.reduce((n, x) => n + x.rows.length, 0)} rows`)
