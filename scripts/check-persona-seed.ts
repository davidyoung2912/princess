// Cross-checks db/seed/personas/*.sql against the generator and db/01-schema.sql: `npm run db:persona:check`.
// No SQL Server here, so this stands in for "will it load": files are current and ASCII, every INSERT names real columns,
// leaves out no required column, keeps text inside its column, respects closed lists, and natural keys are unique.
import { readFileSync } from 'node:fs'
import { buildFiles, catalogue, runAll, PEOPLE, EMAIL_DOMAIN } from './persona-seed.ts'

const errors: string[] = []
const fail = (m: string) => errors.push(m)
const schema = readFileSync(new URL('../db/01-schema.sql', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')

function splitTop(body: string): string[] {
  const parts: string[] = []
  let depth = 0, start = 0, quote = false
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === "'") quote = !quote
    if (quote) continue
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) { parts.push(body.slice(start, i)); start = i + 1 }
  }
  parts.push(body.slice(start))
  return parts.map((p) => p.trim()).filter(Boolean)
}

interface Col { length: number | null; required: boolean; allowed: string[] | null; type: string }
const tables = new Map<string, Map<string, Col>>()
for (const m of schema.matchAll(/CREATE TABLE (dbo|demo)\.(\w+) \(/g)) {
  let depth = 1, i = m.index! + m[0].length
  const start = i
  while (depth > 0) { if (schema[i] === '(') depth++; else if (schema[i] === ')') depth--; i++ }
  const cols = new Map<string, Col>()
  const checks: string[] = []
  for (const part of splitTop(schema.slice(start, i - 1))) {
    if (/^CONSTRAINT\b/i.test(part)) { if (/CHECK/i.test(part)) checks.push(part); continue }
    const c = /^\[?(\w+)\]?\s+(\w+)(?:\((\w+)\))?([\s\S]*)$/.exec(part)
    if (!c) continue
    cols.set(c[1], { type: c[2].toUpperCase(), length: c[3] && /^\d+$/.test(c[3]) ? Number(c[3]) : null, required: /NOT NULL/i.test(c[4]) && !/DEFAULT|IDENTITY|ROWVERSION/i.test(c[4]) && c[2].toUpperCase() !== 'ROWVERSION', allowed: null })
  }
  for (const ck of checks) {
    const inList = /CHECK \(\[?(\w+)\]? IN \(([^)]*)\)\)/i.exec(ck)
    if (inList && cols.has(inList[1])) cols.get(inList[1])!.allowed = [...inList[2].matchAll(/'([^']*)'/g)].map((x) => x[1])
  }
  tables.set(`${m[1]}.${m[2]}`, cols)
}

const files = { ...buildFiles(), 'run-all': runAll() }
for (const [name, sql] of Object.entries(files)) {
  let disk = ''
  try { disk = readFileSync(new URL(`../db/seed/personas/${name}.sql`, import.meta.url), 'utf8') } catch { fail(`${name}.sql is missing: run npm run db:persona:gen`) }
  if (disk && disk !== sql) fail(`${name}.sql is out of date: run npm run db:persona:gen`)
  if ([...sql].some((ch) => ch.charCodeAt(0) > 126)) fail(`${name}.sql contains non-ASCII characters`)
}
try { if (readFileSync(new URL('../db/seed/personas/README.md', import.meta.url), 'utf8') !== catalogue()) fail('README.md is out of date: run npm run db:persona:gen') } catch { fail('README.md is missing') }

let inserts = 0, rowsTotal = 0
for (const [name, sql] of Object.entries(buildFiles())) {
  for (const m of sql.matchAll(/INSERT INTO ([\w.]+) \(([^)]*)\) VALUES\n([\s\S]*?);\n/g)) {
    inserts++
    const table = m[1]
    const def = tables.get(table)
    if (!def) { fail(`${name}: ${table} is not a table in the schema`); continue }
    const cols = m[2].split(',').map((c) => c.replace(/[[\]\s]/g, ''))
    for (const c of cols) if (!def.has(c)) fail(`${name}: ${table}.${c} is not a column`)
    for (const [c, spec] of def) if (spec.required && !cols.includes(c)) fail(`${name}: ${table}.${c} is required but not set`)
    const rows = splitTop(m[3].replace(/^\s*\(/, '').replace(/\)\s*$/, '').split(/\),\n\s*\(/).join('),(')).length
    void rows
    for (const line of m[3].split(/\),?\n/)) {
      const body = line.trim().replace(/^\(/, '').replace(/\)$/, '')
      if (!body) continue
      rowsTotal++
      const cells = splitTop(body)
      if (cells.length !== cols.length) { fail(`${name}: ${table} row has ${cells.length} cells for ${cols.length} columns: ${body.slice(0, 80)}`); continue }
      cells.forEach((cell, i) => {
        const spec = def.get(cols[i])
        if (!spec) return
        const lit = /^N?'((?:[^']|'')*)'$/.exec(cell)
        if (lit) {
          const s = lit[1].replace(/''/g, "'")
          if (spec.length !== null && s.length > spec.length) fail(`${name}: ${table}.${cols[i]} is ${s.length} characters, holds ${spec.length}`)
          if (spec.allowed && !spec.allowed.includes(s)) fail(`${name}: ${table}.${cols[i]} is "${s}", allowed ${spec.allowed.join(', ')}`)
          if (/^[{[]/.test(s)) { try { JSON.parse(s) } catch { fail(`${name}: ${table}.${cols[i]} looks like JSON but does not parse: ${s.slice(0, 60)}`) } }
          if (/^N'/.test(s)) fail(`${name}: ${table}.${cols[i]} was quoted twice: ${s.slice(0, 40)}`)
        }
        if (cell === 'NULL' && spec.required) fail(`${name}: ${table}.${cols[i]} is NULL but required`)
      })
    }
  }
}

const slugs = PEOPLE.map((p) => p.slug)
if (new Set(slugs).size !== slugs.length) fail('duplicate slug')
const sql = Object.values(buildFiles()).join('\n')
const dup = (re: RegExp, what: string) => {
  const seen = new Set<string>()
  for (const m of sql.matchAll(re)) { if (seen.has(m[1])) fail(`${what} ${m[1]} is used twice`); seen.add(m[1]) }
}
dup(/N'(\d{10})'/g, 'account number')
dup(/N'(\w+)', N'(?:direct|agent)'/g, 'booking number')
for (const m of sql.matchAll(/N'(\w+)', N'(?:direct|agent)'/g)) if (!/^[A-Za-z0-9]{8}$/.test(m[1])) fail(`booking number ${m[1]} must be exactly 8 letters or digits (CHAR(8) pads shorter values)`)
if (!sql.includes(`@${EMAIL_DOMAIN}`)) fail('no demo emails found')

if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(`persona seed ok: ${PEOPLE.length} people, ${inserts} inserts, ${rowsTotal} rows`)
