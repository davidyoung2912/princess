// Cross-checks db/01-schema.sql against docs/backend-data-model.md: `npm run db:check`.
// There is no SQL Server in this repo's tooling, so this is the stand-in for "does the script hang together":
//   - every table in the script is named in section 4 of the document, and every table the document names is in the script;
//   - tables are created after the tables their foreign keys point to;
//   - foreign key columns exist and have the same type as the column they reference;
//   - constraint names are unique per schema (SQL Server requires it) and every table has a primary key;
//   - every `Id BIGINT IDENTITY` table has a PublicId unless the document's section 2 lists it as having none.
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../db/01-schema.sql', import.meta.url), 'utf8')
const doc = readFileSync(new URL('../docs/backend-data-model.md', import.meta.url), 'utf8')

const errors = []
const fail = (message) => errors.push(message)

const norm = (type) => type.replace(/\s+/g, '').toUpperCase()

/** Splits on commas that are not inside parentheses. */
function splitTop(text) {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts.map((p) => p.trim()).filter(Boolean)
}

const noComments = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')

// Tables, in file order.
const tables = new Map()
const header = /CREATE TABLE (\w+)\.(\w+) \(/g
for (let m = header.exec(noComments); m; m = header.exec(noComments)) {
  const start = header.lastIndex
  let depth = 1
  let i = start
  while (depth > 0 && i < noComments.length) {
    if (noComments[i] === '(') depth++
    else if (noComments[i] === ')') depth--
    i++
  }
  const full = `${m[1]}.${m[2]}`
  if (tables.has(full)) fail(`${full} is created twice`)
  const columns = new Map()
  const constraints = []
  for (const part of splitTop(noComments.slice(start, i - 1))) {
    if (/^CONSTRAINT\b/i.test(part)) {
      constraints.push(part)
      continue
    }
    const col = /^(\[\w+\]|\w+)\s+([A-Za-z0-9]+(?:\([^)]*\))?)/.exec(part)
    if (!col) {
      fail(`${full}: cannot read column definition "${part.slice(0, 60)}"`)
      continue
    }
    const name = col[1].replace(/[[\]]/g, '')
    if (columns.has(name)) fail(`${full}: duplicate column ${name}`)
    columns.set(name, { type: norm(col[2]), text: part })
    for (const inline of part.matchAll(/CONSTRAINT\s+(\w+)\s+(PRIMARY KEY|UNIQUE|DEFAULT|CHECK)/gi)) {
      constraints.push(`CONSTRAINT ${inline[1]} ${inline[2].toUpperCase()}${inline[2].toUpperCase() === 'PRIMARY KEY' ? ` (${name})` : ''}`)
    }
  }
  tables.set(full, { order: tables.size, columns, constraints })
}

// Constraint names unique per schema, primary key present, PublicId present.
const exclusion = /unless listed here as having none:\*\*([^\n]*?)Tables keyed/.exec(doc)
const noPublicId = new Set([...(exclusion?.[1] ?? '').matchAll(/`(\w+)`/g)].map((m) => m[1]))
if (noPublicId.size < 10) fail('could not read the "no PublicId" list from section 2 of the document')

const names = new Map()
for (const [full, table] of tables) {
  const [schema, name] = full.split('.')
  let hasPk = false
  for (const text of table.constraints) {
    const cn = /^CONSTRAINT\s+(\w+)/i.exec(text)?.[1]
    if (!cn) continue
    const key = `${schema}.${cn}`
    if (names.has(key)) fail(`constraint name ${cn} used by both ${names.get(key)} and ${full}`)
    names.set(key, full)
    if (/PRIMARY KEY/i.test(text)) hasPk = true
  }
  if (!hasPk) fail(`${full} has no primary key`)
  const id = table.columns.get('Id')
  if (schema === 'dbo' && id && /IDENTITY/i.test(id.text)) {
    const has = table.columns.has('PublicId')
    if (noPublicId.has(name) && has) fail(`${full} should not have a PublicId (section 2 lists it as having none)`)
    if (!noPublicId.has(name) && !has) fail(`${full} has an identity Id but no PublicId`)
  }
  if (schema === 'dbo' && !table.columns.has('CreatedAt')) fail(`${full} has no CreatedAt`)
}

// Foreign keys: target created earlier, columns exist, types agree.
let fkCount = 0
for (const [full, table] of tables) {
  for (const text of table.constraints) {
    const fk = /FOREIGN KEY\s*\(([^)]*)\)\s*REFERENCES\s+(\w+\.\w+)\s*\(([^)]*)\)/i.exec(text)
    if (!fk) continue
    fkCount++
    const cn = /^CONSTRAINT\s+(\w+)/i.exec(text)?.[1]
    const target = tables.get(fk[2])
    if (!target) {
      fail(`${full}.${cn}: references ${fk[2]}, which the script never creates`)
      continue
    }
    if (target.order > table.order) fail(`${full}.${cn}: ${fk[2]} is created later in the file`)
    const from = fk[1].split(',').map((c) => c.replace(/[[\]\s]/g, ''))
    const to = fk[3].split(',').map((c) => c.replace(/[[\]\s]/g, ''))
    if (from.length !== to.length) fail(`${full}.${cn}: column counts differ`)
    from.forEach((c, i) => {
      const a = table.columns.get(c)
      const b = target.columns.get(to[i])
      if (!a) fail(`${full}.${cn}: no column ${c}`)
      else if (!b) fail(`${full}.${cn}: ${fk[2]} has no column ${to[i]}`)
      else if (a.type !== b.type) fail(`${full}.${cn}: ${c} is ${a.type} but ${fk[2]}.${to[i]} is ${b.type}`)
    })
  }
}

// Indexes point at real tables and columns.
for (const m of noComments.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+(\w+\.\w+)\s*\(([^)]*)\)/gi)) {
  const table = tables.get(m[2])
  if (!table) {
    fail(`index ${m[1]}: no table ${m[2]}`)
    continue
  }
  for (const part of m[3].split(',')) {
    const c = part.trim().replace(/\s+(ASC|DESC)$/i, '').replace(/[[\]]/g, '')
    if (!table.columns.has(c)) fail(`index ${m[1]}: ${m[2]} has no column ${c}`)
  }
}

// The document: section 4 names every table; its bold names are all tables.
const section4 = doc.slice(doc.indexOf('## 4. Tables'), doc.indexOf('## 5. JSON columns'))
const words = new Set(section4.match(/\w+/g))
for (const full of tables.keys()) {
  const name = full.split('.')[1]
  if (!words.has(name)) fail(`${full} is not named in section 4 of docs/backend-data-model.md`)
}
// Bold names in section 4 that are deliberately not tables.
const notTables = new Set([
  'Menus', // "Menus / MenuItems": only MenuItems and MenuExtras exist
  'LastMinuteTours', // TourBookings.Source = 'onboard'
  'AdvisorQuiz', // stays in code (pure scoring)
])
const tableNames = new Set([...tables.keys()].map((f) => f.split('.')[1]))
for (const m of section4.matchAll(/\*\*([A-Za-z][\w ()/,*]*?)\*\*/g)) {
  for (const name of m[1].split(/\s*\/\s*/)) {
    const bare = name.replace(/[^A-Za-z]/g, '')
    if (/^[A-Z][A-Za-z]+$/.test(bare) && !tableNames.has(bare) && !notTables.has(bare)) {
      if (/^(Api|Decision|API)$/.test(bare) || bare.length < 4) continue
      fail(`section 4 names "${bare}" in bold but the script has no such table`)
    }
  }
}

const perSchema = {}
for (const full of tables.keys()) perSchema[full.split('.')[0]] = (perSchema[full.split('.')[0]] ?? 0) + 1
console.log(`${tables.size} tables (${Object.entries(perSchema).map(([s, n]) => `${s}: ${n}`).join(', ')}), ${fkCount} foreign keys`)
if (errors.length) {
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}:`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('db/01-schema.sql matches docs/backend-data-model.md')
