import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The audit gate of multi-device plans 2 and 3 (Phase 7). The goal is a thin client: no screen reads an authored catalogue or a simulation straight from
 * a domain module, and nothing outside the stores keeps data in `localStorage`. Both lists below are a ratchet: they hold what still does so today
 * (each is work for a later phase), a new file doing the same fails the test, and a file that no longer does must be taken off the list.
 */
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []))

/** Domain modules that hold an authored catalogue or a simulation a server now serves or will serve. */
/** (The sailings, ports, excursions and dining stores hold no authored data any more: they fill from the server's tables, so reading them is fine.) */
/** (`pulse` is the Pulse screen's own list of which venues it shows and where each links; `cabinScore` is comparison logic. Neither holds reference data: the levels, scores and prices come from the server or from `pricing`/`fares`.) */
const CATALOGUE = ['pricing']
const importsCatalogue = (text: string): boolean =>
  CATALOGUE.some((m) => new RegExp(`from '(\\.\\./)+domain/${m}'`).test(text))

const allSource = () => files('src').filter((f) => !f.endsWith('.d.ts')).map((f) => f.replaceAll('\\', '/')).sort()
const textOf = (f: string) => readFileSync(f, 'utf8')
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

describe('audit gate', () => {
  it('keeps the test fixtures out of the app: nothing outside tests imports src/testing', () => {
    const found = allSource().filter((f) => !f.startsWith('src/testing/') && /from '(\.\.?\/)+(\w+\/)*testing\//.test(textOf(f)))
    expect(found).toEqual([])
  })

  it('has no in-browser backend: no IndexedDB store, no mock API or mock auth provider', () => {
    const offenders = allSource().filter((f) => /idbStore|from '[^']*Mock'|\bmockApi\b|mockProvider|indexedDB/.test(withoutComments(textOf(f))))
    expect(offenders).toEqual([])
  })

  it('reads VITE_API_URL in exactly one place', () => {
    const readers = allSource().filter((f) => /VITE_API_URL/.test(withoutComments(textOf(f))))
    expect(readers).toEqual(['src/runtime/index.ts'])
  })

  it('has no persona table: nothing imports a list of demo people or translates their ids', () => {
    const found = allSource().filter((f) => /from '(\.\.?\/)+(\w+\/)*(personas|personaIds)'|from '\.\/(personas|personaIds)'/.test(textOf(f)))
    expect(found).toEqual([])
  })

  it('names none of the twelve demo people in the client', () => {
    const found = allSource().filter((f) => /'(gerald|maria|linda|alexander|daniel|priya|ethan|maya|marcus|elena|lucas|sofia)'/.test(withoutComments(textOf(f))))
    expect(found).toEqual([])
  })

  it('has no file naming a simulated source: the front end does not know whether data is simulated', () => {
    const found = allSource().filter((f) => /'sim'/.test(withoutComments(textOf(f))))
    expect(found).toEqual([])
  })

  it('has no screen importing an authored catalogue or simulation module beyond the known list', () => {
    const found = files('src/ui').filter((f) => importsCatalogue(readFileSync(f, 'utf8'))).map((f) => f.replaceAll('\\', '/')).sort()
    expect(found).toEqual([])
  })

  it('keeps localStorage inside the stores, settings, sync and runtime', () => {
    const outside = files('src')
      .filter((f) => !f.endsWith('.d.ts'))
      .filter((f) => /\blocalStorage\b/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replaceAll('\\', '/'))
      .filter((f) => !LOCAL_STORAGE_OK.some((ok) => f.startsWith(ok)))
      .sort()
    expect(outside).toEqual(KNOWN_LOCAL_STORAGE_OUTSIDE)
  })
})

const LOCAL_STORAGE_OK = ['src/ai/', 'src/data/', 'src/design/', 'src/demo/', 'src/hub/', 'src/journey/', 'src/memory/', 'src/offers/', 'src/party/', 'src/phone/', 'src/pilot/', 'src/port/', 'src/runtime/', 'src/settings/', 'src/shop/', 'src/sync/', 'src/auth/', 'src/diagnostics/', 'src/rates/', 'src/feeds/feed.ts', 'src/hooks/useOutbox.ts', 'src/hooks/useSavedCopy.ts']
/** Screens that keep a small device-only setting themselves (diagnostics switch, a support draft, the pass finder). */
const KNOWN_LOCAL_STORAGE_OUTSIDE: string[] = ['src/ui/DiagnosticsSettings.tsx', 'src/ui/aboard/SupportScreens.tsx', 'src/ui/boarding/FindPassScreen.tsx']
