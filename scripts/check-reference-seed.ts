// Cross-checks db/seed/reference/*.sql against the TypeScript source and db/01-schema.sql: `npm run db:seed:check`.
// There is no SQL Server in this repo's tooling, so this is the stand-in for "will the seeds load":
//   - the files on disk equal what the generator produces from the source now (nothing hand-edited, nothing stale);
//   - every ref table in the schema has a seed, every seeded column exists, and no required column is left out;
//   - keys are unique, text fits its column, closed lists (CHECK ... IN) hold, JSON columns parse;
//   - every foreign key from one ref table to another points at a seeded row;
//   - row counts agree with the source arrays.
import { readFileSync } from 'node:fs'
import { buildTables, FILE_TITLES, renderFile, type Table } from './reference-seed.ts'
import { SAILINGS } from '../src/domain/sailings.ts'
import { EXCURSIONS } from '../src/domain/excursions.ts'
import { EVENTS } from '../src/domain/program.ts'
import { VENUES } from '../src/domain/dining.ts'
import { MENU } from '../src/domain/orders.ts'
import { CATEGORIES } from '../src/domain/ship.ts'
import { FAQS } from '../src/domain/help.ts'
import { LEGAL } from '../src/domain/policy.ts'
import { CHECKLIST } from '../src/domain/checklist.ts'
import { ADVISORS } from '../src/domain/ahead.ts'
import { CREW } from '../src/domain/postcruise.ts'

const errors: string[] = []
const fail = (m: string) => errors.push(m)

const schema = readFileSync(new URL('../db/01-schema.sql', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')

function splitTop(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) { parts.push(body.slice(start, i)); start = i + 1 }
  }
  parts.push(body.slice(start))
  return parts.map((p) => p.trim()).filter(Boolean)
}

interface SchemaCol { type: string; length: number | null; required: boolean; allowed: string[] | null }
interface SchemaFk { cols: string[]; to: string; toCols: string[] }
const tables = new Map<string, { cols: Map<string, SchemaCol>; fks: SchemaFk[] }>()
for (const m of schema.matchAll(/CREATE TABLE (ref)\.(\w+) \(/g)) {
  let depth = 1
  let i = m.index! + m[0].length
  const start = i
  while (depth > 0) { if (schema[i] === '(') depth++; else if (schema[i] === ')') depth--; i++ }
  const cols = new Map<string, SchemaCol>()
  const fks: SchemaFk[] = []
  const checks: string[] = []
  for (const part of splitTop(schema.slice(start, i - 1))) {
    if (/^CONSTRAINT\b/i.test(part)) {
      const fk = /FOREIGN KEY \(([^)]*)\) REFERENCES (\w+\.\w+) \(([^)]*)\)/i.exec(part)
      if (fk) fks.push({ cols: fk[1].split(',').map((c) => c.replace(/[[\]\s]/g, '')), to: fk[2], toCols: fk[3].split(',').map((c) => c.replace(/[[\]\s]/g, '')) })
      if (/CHECK/i.test(part)) checks.push(part)
      continue
    }
    const col = /^\[?(\w+)\]?\s+(\w+)(?:\((\w+)\))?([\s\S]*)$/.exec(part)
    if (!col) continue
    const rest = col[4]
    cols.set(col[1], { type: col[2].toUpperCase(), length: col[3] && col[3] !== 'MAX' && /^\d+$/.test(col[3]) ? Number(col[3]) : null, required: /NOT NULL/i.test(rest) && !/DEFAULT/i.test(rest) && !/IDENTITY/i.test(rest), allowed: null })
  }
  for (const c of checks) {
    const inList = /CHECK \(\[?(\w+)\]? IN \(([^)]*)\)\)/i.exec(c)
    if (inList && cols.has(inList[1])) cols.get(inList[1])!.allowed = [...inList[2].matchAll(/'([^']*)'/g)].map((x) => x[1])
  }
  tables.set(`ref.${m[2]}`, { cols, fks })
}

const built = buildTables()
const byName = new Map<string, Table>(built.map((t) => [t.name, t]))

// Files on disk are what the generator writes now.
for (const file of Object.keys(FILE_TITLES)) {
  let onDisk = ''
  try { onDisk = readFileSync(new URL(`../db/seed/reference/${file}.sql`, import.meta.url), 'utf8') } catch { fail(`${file}.sql is missing: run npm run db:seed:gen`) }
  if (onDisk && onDisk !== renderFile(file, built)) fail(`${file}.sql is out of date with the source: run npm run db:seed:gen`)
  if ([...onDisk].some((ch) => ch.charCodeAt(0) > 126)) fail(`${file}.sql contains non-ASCII characters`)
}

for (const name of tables.keys()) if (!byName.has(name)) fail(`${name} has no seed`)

const keyOf = (t: Table, row: unknown[]) => t.key.map((k) => String(row[t.cols.findIndex((c) => c.name === k)])).join('|')

for (const t of built) {
  const def = tables.get(t.name)
  if (!def) { fail(`${t.name} is not a ref table in the schema`); continue }
  const names = t.cols.map((c) => c.name)
  for (const n of names) if (!def.cols.has(n)) fail(`${t.name}.${n} is not a column in the schema`)
  for (const [n, c] of def.cols) if (c.required && !names.includes(n)) fail(`${t.name}.${n} is required but not seeded`)
  if (t.rows.length === 0) fail(`${t.name} has no rows`)
  const seen = new Set<string>()
  t.rows.forEach((row, r) => {
    if (row.length !== t.cols.length) fail(`${t.name} row ${r} has ${row.length} cells for ${t.cols.length} columns`)
    const key = keyOf(t, row)
    if (seen.has(key)) fail(`${t.name} has the key ${key} twice`)
    seen.add(key)
    t.cols.forEach((col, i) => {
      const spec = def.cols.get(col.name)
      const cell = row[i]
      if (!spec) return
      if (spec.required && (cell === null || cell === undefined)) fail(`${t.name} row ${key}: ${col.name} is null`)
      if (typeof cell === 'string' && col.type === 'str' && spec.length !== null && cell.length > spec.length) fail(`${t.name} row ${key}: ${col.name} is ${cell.length} characters, the column holds ${spec.length}`)
      if (spec.allowed && typeof cell === 'string' && !spec.allowed.includes(cell)) fail(`${t.name} row ${key}: ${col.name} is "${cell}", allowed: ${spec.allowed.join(', ')}`)
      if (col.type === 'json') { try { JSON.parse(typeof cell === 'string' ? cell : JSON.stringify(cell)) } catch { fail(`${t.name} row ${key}: ${col.name} is not JSON`) } }
      if (col.type === 'time' && typeof cell === 'string' && !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(cell)) fail(`${t.name} row ${key}: ${col.name} "${cell}" is not a time`)
      if (col.type === 'date' && typeof cell === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(cell)) fail(`${t.name} row ${key}: ${col.name} "${cell}" is not a date`)
    })
  })
}

// Foreign keys between ref tables.
for (const [name, def] of tables) {
  const t = byName.get(name)
  if (!t) continue
  for (const fk of def.fks) {
    const target = byName.get(fk.to)
    if (!target) { fail(`${name} points at ${fk.to}, which has no seed`); continue }
    const wanted = new Set(target.rows.map((row) => fk.toCols.map((c) => String(row[target.cols.findIndex((x) => x.name === c)])).join('|')))
    for (const row of t.rows) {
      const parts = fk.cols.map((c) => row[t.cols.findIndex((x) => x.name === c)])
      if (parts.some((p) => p === null || p === undefined)) continue
      if (!wanted.has(parts.map(String).join('|'))) fail(`${name} ${keyOf(t, row)}: (${fk.cols.join(', ')}) = ${parts.join(', ')} is not in ${fk.to}`)
    }
  }
}

// Counts against the source arrays.
const count = (name: string, expected: number) => {
  const got = byName.get(name)?.rows.length
  if (got !== expected) fail(`${name} has ${got} rows, the source has ${expected}`)
}
count('ref.Sailings', SAILINGS.length)
count('ref.ItineraryDays', SAILINGS.length * 8)
count('ref.Excursions', EXCURSIONS.length)
count('ref.ExcursionDepartures', EXCURSIONS.length * SAILINGS.length)
count('ref.Events', EVENTS.length)
count('ref.EventDays', EVENTS.reduce((n, e) => n + e.days.length, 0) * SAILINGS.length)
count('ref.CabinCategories', CATEGORIES.length)
count('ref.Cabins', CATEGORIES.length * 9)
count('ref.Faqs', FAQS.length)
count('ref.LegalDocs', LEGAL.length)
count('ref.ChecklistItems', CHECKLIST.length)
count('ref.Advisors', ADVISORS.length)
count('ref.CrewMembers', CREW.length)
count('ref.MenuExtras', MENU.reduce((n, m) => n + m.extras.length, 0))
if (!VENUES.every((v) => byName.get('ref.Venues')?.rows.some((r) => r[0] === v.id))) fail('a dining.ts venue is missing from ref.Venues')

if (errors.length) {
  console.error(errors.map((e) => `  ${e}`).join('\n'))
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}`)
  process.exit(1)
}
console.log(`${built.length} tables, ${built.reduce((n, t) => n + t.rows.length, 0)} rows: db/seed/reference matches the source and the schema`)
