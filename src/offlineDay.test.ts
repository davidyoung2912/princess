import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cacheGet, cachePut, maxAgeFor } from './domain/offlineCache'

/**
 * N1.3, the offline day. Rendering with no network needs a browser, which the project rules out, so this checks the two things that make an offline day
 * work and that a refactor could silently break: (1) the things a guest needs without signal are kept through `useSavedCopy`, and (2) every screen that
 * shows a kept copy says how old it is (OB-08, PERF-06). A screen that shows a copy without its age is a trust bug, so it fails here.
 */
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name).replaceAll('\\', '/')] : []))
const source = new Map(walk('src').map((f) => [f, readFileSync(f, 'utf8')]))
const withComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
const users = [...source].filter(([f, s]) => f !== 'src/hooks/useSavedCopy.ts' && /useSavedCopy[<(]/.test(withComments(s)))

/** What a guest must be able to open with no signal (base doc OB-03, CHK-14): each kind must be kept by at least one screen. */
const MUST_WORK_OFFLINE: Record<string, string> = {
  pass: 'boarding pass',
  program: 'the day’s schedule',
  dining: 'my reservations',
  folio: 'my bill',
  muster: 'muster station',
  emergency: 'emergency information',
  embark: 'embarkation day',
  portDay: 'the port day',
  receipt: 'what we have on file',
  health: 'health and medical help',
}

/** Kinds shown through a parent that already carries the age, or that feed another copy rather than a page of their own. Each needs a reason. */
const AGE_SHOWN_ELSEWHERE: Record<string, string> = {
  'src/hooks/useOnboardToday.ts': 'a hook; its screens show the copy age through `Saved`',
  'src/hooks/useStanleyMode.ts': 'a hook feeding the Right Now card; the plan screens it points to show the copy age',
}

describe('the offline day', () => {
  it('keeps every must-work-offline thing through useSavedCopy', () => {
    const kinds = new Set(users.flatMap(([, s]) => [...withComments(s).matchAll(/useSavedCopy(?:<[^>]*>)?\(\s*'([^']+)'/g)].map((m) => m[1])))
    const missing = Object.keys(MUST_WORK_OFFLINE).filter((k) => !kinds.has(k))
    expect(missing, `not kept offline: ${missing.map((k) => MUST_WORK_OFFLINE[k]).join(', ')}`).toEqual([])
  })

  it('says how old a kept copy is on every screen that shows one', () => {
    const silent = users
      .filter(([f]) => !(f in AGE_SHOWN_ELSEWHERE))
      .filter(([, s]) => !/<Saved\b|<SyncChip\b|\.fromCopy\b/.test(withComments(s)))
      .map(([f]) => f)
    expect(silent).toEqual([])
  })

  it('does not let the age exemptions go stale', () => {
    for (const f of Object.keys(AGE_SHOWN_ELSEWHERE)) expect(users.some(([u]) => u === f), f).toBe(true)
  })

  it('opens a kept copy with no network, and refuses one that is too old, wrong or damaged', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    const asNumber = (raw: unknown): number | null => (typeof raw === 'number' ? raw : null)
    const saved = Date.UTC(2027, 2, 14, 9, 0)
    expect(cachePut(storage, 'program', 'me:2', 42, saved)).toBe(true)
    // Offline an hour later: the copy opens and says when it was saved.
    expect(cacheGet(storage, 'program', 'me:2', asNumber, saved + 3_600_000)).toEqual({ savedAt: saved, value: 42 })
    // The schedule goes stale after three days; a boarding pass lasts the trip.
    expect(cacheGet(storage, 'program', 'me:2', asNumber, saved + maxAgeFor('program') + 1)).toBeNull()
    cachePut(storage, 'pass', 'b1', 7, saved)
    expect(cacheGet(storage, 'pass', 'b1', asNumber, saved + 6 * 86_400_000)).not.toBeNull()
    // Contents are vetted: a copy of the wrong shape is not shown.
    expect(cacheGet(storage, 'pass', 'b1', (raw) => (typeof raw === 'string' ? raw : null), saved)).toBeNull()
    store.set('princess:cache:pass:b2', '{not json')
    expect(cacheGet(storage, 'pass', 'b2', asNumber, saved)).toBeNull()
  })
})
