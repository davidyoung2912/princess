import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// A static guard for the stats page (docs/review-and-completeness-plan.md, Phase C): `DapperStatsStore` is one batch of scalar sub-selects, so a single misnamed table or
// column fails the whole page at run time, and the server tests that would catch it need a database. This reads the C# and the schema script and checks every table and every
// `alias.Column` the stats query names.
const read = (path: string): string => readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8').replace(/^﻿/, '')
const schema = read('db/01-schema.sql')
const store = read('server/Princess.Api/Data/DapperStatsStore.cs')

const TYPES = 'NVARCHAR|VARCHAR|INT|BIGINT|BIT|DATE|DATETIME2|DATETIME|TIME|DECIMAL|UNIQUEIDENTIFIER|TINYINT|SMALLINT|VARBINARY|CHAR|NCHAR|FLOAT|REAL|MONEY|ROWVERSION'
const tables = new Map<string, Set<string>>()
for (const m of schema.matchAll(/CREATE TABLE\s+((?:dbo|ref)\.\w+)\s*\(([\s\S]*?)\n\);/g)) {
  const cols = new Set<string>()
  for (const line of m[2].split('\n')) for (const c of line.matchAll(new RegExp(`(?:^|,)\\s*\\[?(\\w+)\\]?\\s+(?:${TYPES})`, 'g'))) cols.add(c[1].toLowerCase())
  tables.set(m[1].toLowerCase(), cols)
}
for (const m of schema.matchAll(/ALTER TABLE\s+((?:dbo|ref)\.\w+)\s+ADD\s+([\s\S]*?)(?:;|\nGO|\nEND)/gi)) {
  const cols = tables.get(m[1].toLowerCase()) ?? new Set<string>()
  for (const c of m[2].matchAll(new RegExp(`\\[?(\\w+)\\]?\\s+(?:${TYPES})`, 'g'))) cols.add(c[1].toLowerCase())
  tables.set(m[1].toLowerCase(), cols)
}

const SKIP = new Set(['WHERE', 'JOIN', 'ON', 'GROUP', 'ORDER', 'AS', 'UNION', 'INNER', 'LEFT', 'SELECT', 'AND', 'OR'])
const subSelects = [...store.matchAll(/\(SELECT([\s\S]*?)\)\s+AS (\w+)/g)].map((m) => ({ name: m[2], text: m[1] }))

describe('the SQL behind the real stats', () => {
  it('has the schema and the sub-selects to read', () => {
    expect(tables.size).toBeGreaterThan(200)
    expect(subSelects.length).toBeGreaterThan(90)
  })

  it('names only tables that exist', () => {
    for (const s of subSelects) for (const t of s.text.matchAll(/\b((?:dbo|ref)\.\w+)/g)) expect(tables.has(t[1].toLowerCase()), `${s.name}: ${t[1]}`).toBe(true)
  })

  it('names only columns that exist on the table each alias stands for', () => {
    for (const s of subSelects) {
      const alias = new Map<string, string>()
      for (const m of s.text.matchAll(/\b((?:dbo|ref)\.\w+)(?:\s+(\w+))?/g)) {
        alias.set(m[1].split('.')[1].toLowerCase(), m[1].toLowerCase())
        if (m[2] && !SKIP.has(m[2].toUpperCase())) alias.set(m[2].toLowerCase(), m[1].toLowerCase())
      }
      for (const m of s.text.matchAll(/\b(\w+)\.\[?(\w+)\]?/g)) {
        const table = alias.get(m[1].toLowerCase())
        if (table && tables.has(table)) expect(tables.get(table)!.has(m[2].toLowerCase()), `${s.name}: ${table}.${m[2]}`).toBe(true)
      }
    }
  })

  it('never reports data the app does not record as a real stat', () => {
    // WifiDevices.UsedMb is never written (no source reports usage), so the stat is shown only when a source has filled it in.
    const rules = read('server/Princess.Api/Domain/StatsRules.cs')
    expect(rules).toMatch(/if \(r\.Get\("wifi_mb"\) > 0\)/)
  })
})
