import { enCore } from './locales/enCore'
import type { en, StringKey } from './locales/en'
import { LANGUAGES } from './languages'
import { titleCase } from './titleCase'

type Raw = keyof typeof en

export type { StringKey }
type Catalog = Partial<Record<Raw, string>>
type Params = Record<string, string | number>

const catalogs: Record<string, Catalog> = { en: enCore }
/** English text that arrives after the first screen is drawn (`enRest`, Stanley and the tips); see `loadEnglishLate`. */
let late: Catalog = {}
let lateLoaded = false
const english = (k: string): string | undefined => (enCore as Catalog)[k as Raw] ?? late[k as Raw]

/** Puts the later English text in use. Tests call it with the files' content; the app calls `loadEnglishLate`. */
export function registerEnglishLate(text: Catalog) {
  late = text
  lateLoaded = true
  listeners.forEach((l) => l())
}

let lateLoading: Promise<void> | null = null
/**
 * Brings in the rest of the English text (separate downloads) once; the first screen does not wait for it. Calling it again returns the same promise,
 * and a failed download can be tried again.
 */
export function loadEnglishLate(): Promise<void> {
  if (lateLoaded) return Promise.resolve()
  return (lateLoading ??= (async () => {
    const [{ enRest }, { enLate }, { enAnswers }] = await Promise.all([import('./locales/enRest'), import('./locales/enLate'), import('./locales/enAnswers')])
    registerEnglishLate({ ...enRest, ...enLate, ...enAnswers })
  })().catch((e) => { lateLoading = null; throw e }))
}

/** Resolves once every English string is in (a screen waits for this before it is shown, so it never draws a missing key). Never rejects: a failed download leaves keys showing as they are. */
export const englishReady = (): Promise<void> => loadEnglishLate().catch(() => {})

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
  const found = text ?? pick(key)
  // Text that has not arrived yet draws as nothing (and fills in when it does) rather than as a key; a key the files do not have still shows as itself.
  if (found === undefined && !lateLoaded) return ''
  return fill(found ?? key, params)
}

/** The text for a key as a heading: Title Case in English, unchanged in other languages. */
export const th = (key: StringKey, params: Params = {}): string => titleCase(t(key, params), locale)

/** Already-translated heading text in Title Case (English only). */
export const headingCase = (text: string): string => titleCase(text, locale)
