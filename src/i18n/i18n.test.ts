import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LOCALES, getLocale, loadLocale, registerLocale, setLocale, t } from '.'
import { en } from './locales/en'
import { es } from './locales/es'
import { isLanguage } from './languages'

const sourceFiles = (): string[] => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !path.includes('/locales/')) files.push(path)
    }
  }
  walk(join(__dirname, '..'))
  return files
}

describe('t', () => {
  afterEach(() => setLocale('en'))

  it('fills values and picks plural forms', () => {
    registerLocale('yy', { 'app.name': 'Princess {x}' })
    setLocale('yy')
    expect(t('app.name', { x: 'A' })).toBe('Princess A')
  })

  it('picks the plural form for a count', () => {
    registerLocale('yy', { 'test.day_one': '{count} day', 'test.day_other': '{count} days' } as never)
    setLocale('yy')
    expect(t('test.day' as never, { count: 1 })).toBe('1 day')
    expect(t('test.day' as never, { count: 3 })).toBe('3 days')
  })

  it('falls back to English for a missing key and to the key itself for an unknown one', () => {
    registerLocale('xx', { 'app.name': 'Princesse' })
    setLocale('xx')
    expect(t('app.name')).toBe('Princesse')
    expect(t('error.reload')).toBe('Reload')
    expect(t('nope.nothing' as never)).toBe('nope.nothing')
  })

  it('ignores an unknown locale', () => {
    setLocale('zz')
    expect(getLocale()).toBe('en')
  })

  it('offers English first, and every offered language can be loaded and switched to', async () => {
    expect(LOCALES[0].code).toBe('en')
    for (const { code } of LOCALES) {
      expect(await loadLocale(code)).toBe(true)
      setLocale(code)
      expect(getLocale()).toBe(code)
    }
  })
})

describe('catalog', () => {
  it('has no empty text', () => {
    for (const [k, v] of Object.entries(en)) expect(v.length, k).toBeGreaterThan(0)
  })

  it('has a plural pair for every _one or _other key, with the same {values} in both', () => {
    const keys = Object.keys(en) as (keyof typeof en)[]
    const values = (k: keyof typeof en) => [...en[k].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join()
    for (const k of keys) {
      const m = /^(.*)_(one|other)$/.exec(k)
      if (!m) continue
      const twin = `${m[1]}_${m[2] === 'one' ? 'other' : 'one'}` as keyof typeof en
      expect(en[twin], `${k} has no ${twin}`).toBeDefined()
      expect(values(k), k).toBe(values(twin))
    }
  })

  it('is fully used: every literal t("key") exists, and every key is used somewhere in the source', () => {
    const files = sourceFiles()
    const code = files.map((f) => readFileSync(f, 'utf8')).join('\n')
    const used = new Set([...code.matchAll(/\bth?\(\s*['"]([a-z][A-Za-z0-9.]*)['"]/g)].map((m) => m[1]))
    // A key named anywhere as a string literal (a `labelKey: 'tab.home'` in a table) also counts as used; the type checker guards typos there.
    const named = new Set([...code.matchAll(/['"]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)['"]/g)].map((m) => m[1]))
    // Keys built from a prefix, e.g. t(`settings.theme.${value}`), count as using every key under that prefix.
    const prefixes = [...code.matchAll(/\bth?\(\s*`([a-z][A-Za-z0-9.]*\.)\$\{/g)].map((m) => m[1])
    const base = (k: string) => k.replace(/_(one|other)$/, '')
    const defined = new Set(Object.keys(en).map(base))
    for (const k of used) expect(defined.has(k), `t('${k}') has no catalog entry`).toBe(true)
    for (const p of prefixes) expect([...defined].some((k) => k.startsWith(p)), `no key starts with ${p}`).toBe(true)
    const unused = [...defined].filter((k) => !used.has(k) && !named.has(k) && !prefixes.some((p) => k.startsWith(p)))
    expect(unused, 'catalog keys never used in the source').toEqual([])
  })
})

/** The groups of text a Spanish reader needs before anything else: the shell, tabs, every page title, the deck map and route finder, and the display settings. */
const SPANISH_REQUIRED = /^(app|common|error|shell|tab|route|lang|settings|map|rt|plan2|txt)\./

describe('Spanish', () => {
  afterEach(() => setLocale('en'))
  const keys = Object.keys(en) as (keyof typeof en)[]

  it('covers every required key, so a new English key in those groups fails until it is translated', () => {
    const missing = keys.filter((k) => (SPANISH_REQUIRED.test(k) || k === 'onb.notStepFree') && !es[k])
    expect(missing).toEqual([])
  })

  it('has no key English does not have, no empty text, and the same {values} as English', () => {
    const values = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join()
    for (const [k, v] of Object.entries(es)) {
      expect(k in en, `${k} is not an English key`).toBe(true)
      expect(v.length, k).toBeGreaterThan(0)
      expect(values(v), k).toBe(values(en[k as keyof typeof en]))
    }
  })

  it('is offered by name in itself, and loads on request', async () => {
    expect(LOCALES.map((l) => l.code)).toEqual(['en', 'es'])
    expect(isLanguage('es')).toBe(true)
    expect(isLanguage('fr')).toBe(false)
    expect(await loadLocale('es')).toBe(true)
    setLocale('es')
    expect(t('tab.home')).toBe('Inicio')
    expect(t('map.found', { count: 1 })).toBe('1 lugar encontrado')
    expect(t('map.found', { count: 3 })).toBe('3 lugares encontrados')
    expect(t('error.title')).toBe('Algo salió mal')
  })

  it('falls back to English for text not yet translated', async () => {
    await loadLocale('es')
    setLocale('es')
    expect(t('poll.votes' as never, { count: 2 })).toBe(en['poll.votes_other' as keyof typeof en]?.replace('{count}', '2') ?? 'poll.votes')
    expect(await loadLocale('zz')).toBe(false)
  })
})
