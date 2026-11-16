import { enCore } from './locales/enCore'
import type { en, StringKey } from './locales/en'
import { LANGUAGES } from './languages'
import { titleCase } from './titleCase'

type Raw = keyof typeof en

export type { StringKey }
type Catalog = Partial<Record<Raw, string>>
type Params = Record<string, string | number>

const catalogs: Record<string, Catalog> = { en: enCore }
/** English text that arrives after the first script (Stanley and the tips); see `loadEnglishLate`. */
let late: Catalog = {}
const english = (k: string): string | undefined => (enCore as Catalog)[k as Raw] ?? late[k as Raw]

/** Puts the Stanley and tip text in use. Tests call it with the file's content; the app calls `loadEnglishLate`. */
export function registerEnglishLate(text: Catalog) {
  late = text
  listeners.forEach((l) => l())
}

/** Brings in the Stanley and tip text (a separate download) before the first screen is drawn. */
export async function loadEnglishLate(): Promise<void> {
  if (Object.keys(late).length > 0) return
  registerEnglishLate((await import('./locales/enLate')).enLate)
}

/** Every English key, the Stanley and tip ones included once they are loaded. */
export const englishKeys = (): string[] => [...Object.keys(enCore), ...Object.keys(late)]
/** Whether English has text for the key. */
export const hasText = (key: string): boolean => english(key) !== undefined
let locale = 'en'

/** Adds or extends the text for a language; keys left out fall back to English. */
export function registerLocale(code: string, catalog: Catalog) {
  catalogs[code] = { ...catalogs[code], ...catalog }
}

/** The languages the settings offer, each named in itself. A language is usable once `loadLocale` has brought its text in. */
export const LOCALES: readonly { code: string; name: string }[] = LANGUAGES

const listeners = new Set<() => void>()
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setLocale(code: string) {
  const next = catalogs[code] ? code : 'en'
  if (next === locale) return
  locale = next
  listeners.forEach((l) => l())
}

/** Brings a language's text in (a separate download, only when chosen) and registers it; English needs nothing. A failed download leaves English in use. */
export async function loadLocale(code: string): Promise<boolean> {
  if (catalogs[code]) return true
  try {
    if (code === 'es') registerLocale('es', (await import('./locales/es')).es)
    return !!catalogs[code]
  } catch {
    return false
  }
}

export const getLocale = () => locale

const fill = (text: string, params: Params) => text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole))

/** The text for a key in the current language with `{name}` values filled in; a `count` picks the `_one` or `_other` form. */
export function t(key: StringKey, params: Params = {}): string {
  const pick = (k: string) => catalogs[locale]?.[k as Raw] ?? english(k)
  let text: string | undefined
  if ('count' in params) {
    const form = new Intl.PluralRules(locale).select(Number(params.count))
    text = pick(`${key}_${form}`) ?? pick(`${key}_other`)
  }
  return fill(text ?? pick(key) ?? key, params)
}

/** The text for a key as a heading: Title Case in English, unchanged in other languages. */
export const th = (key: StringKey, params: Params = {}): string => titleCase(t(key, params), locale)

/** Already-translated heading text in Title Case (English only). */
export const headingCase = (text: string): string => titleCase(text, locale)
