import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Traceability ratchet (BM17, layer L2 of docs/best-in-market-plan-2.md).
 *
 * A test proves a requirement clause by naming it in a comment: `// proves: DEB-02#1, DEB-02#2` (`#n` is the clause number in
 * docs/requirements-clauses.md; a bare ID means the whole requirement). The rules:
 *   1. every tag points at a real requirement, and a real clause number;
 *   2. every P0 requirement the matrix calls Built has a tag, or is on docs/requirements-untagged.txt;
 *   3. that list only shrinks: an ID that is now tagged, or is no longer a P0 Built row, must be taken off it;
 *   4. every requirement a person judged a GAP in docs/requirements-verdicts.tsv has a tag (its pinning test in wordingGuards.test.ts).
 */
const ID = /^[A-Z][A-Z0-9]{1,3}-\d\d$/
const cells = (line: string): string[] => line.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim())
const lines = (p: string): string[] => readFileSync(p, 'utf8').split('\n')

const clauseCount = new Map<string, number>()
for (const line of lines('docs/princess_cruises_expanded_best_in_market_requirements.md')) {
  if (!line.startsWith('|')) continue
  const c = cells(line)
  if (!ID.test(c[0]) || c.length < 3 || clauseCount.has(c[0])) continue
  clauseCount.set(c[0], (c.length > 3 ? c[3] : c[2]).split(/(?<=[.;])\s+/).filter((s) => s.trim().length > 3).length)
}

const p0Built: string[] = []
for (const line of lines('docs/best-in-market-matrix.md')) {
  if (!line.startsWith('|')) continue
  const c = cells(line)
  if (ID.test(c[0]) && c.length === 6 && c[1] === 'P0' && c[2] === 'Built') p0Built.push(c[0])
}

const testFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? testFiles(join(dir, e.name)) : /\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []))
const TAG = new RegExp(['pro', 'ves:\\s*([A-Z0-9#, -]+)'].join(''), 'g') // built in two parts so this file's own comments are not read as tags
const tags: { file: string; id: string; clause: number | null }[] = []
for (const f of testFiles('src').sort()) {
  for (const m of readFileSync(f, 'utf8').matchAll(TAG)) {
    for (const t of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
      const [id, n] = t.split('#')
      tags.push({ file: f.replaceAll('\\', '/'), id, clause: n === undefined ? null : Number(n) })
    }
  }
}
const tagged = new Set(tags.map((t) => t.id))
const untagged = lines('docs/requirements-untagged.txt').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))

describe('requirement traceability', () => {
  it('reads the requirements and the matrix', () => {
    expect(clauseCount.size).toBe(292)
    expect(p0Built.length).toBeGreaterThan(80)
  })

  it('every tag names a real requirement and clause', () => {
    const bad = tags.filter((t) => !clauseCount.has(t.id) || (t.clause !== null && (t.clause < 1 || t.clause > (clauseCount.get(t.id) ?? 0))))
    expect(bad.map((t) => `${t.file}: ${t.id}${t.clause === null ? '' : `#${t.clause}`}`)).toEqual([])
  })

  it('every P0 Built requirement has a tagged test or is on the untagged list', () => {
    const missing = p0Built.filter((id) => !tagged.has(id) && !untagged.includes(id))
    expect(missing).toEqual([])
  })

  it('the untagged list only shrinks: nothing on it is tagged now, or is no longer a P0 Built row, or is repeated', () => {
    const stale = untagged.filter((id) => tagged.has(id) || !p0Built.includes(id))
    expect(stale).toEqual([])
    expect(new Set(untagged).size).toBe(untagged.length)
  })

  it('every requirement judged a gap has a pinning test', () => {
    const gaps = lines('docs/requirements-verdicts.tsv').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t')).filter((c) => c[1] === 'GAP').map((c) => c[0])
    expect(gaps.filter((id) => !tagged.has(id))).toEqual([])
  })
})
