import { isConsentRegion, type ConsentRegion } from '../domain/ahead'
import { isUnits, type Units } from '../domain/readiness'
import { DEFAULT_CHARGE_CHECK, isChargeCheck, type ChargeCheck } from '../domain/moneyShield'
import { DEFAULT_NUDGES, isNudgeBudget, type NudgeBudget } from '../domain/nudges'
import { isLanguage } from '../i18n/languages'
import { DEFAULT_TEXT_SIZE, isTextSize, type TextSize } from '../design/textSize'

/** How the guest chose the colour theme; "auto" follows the device. */
export type ThemeChoice = 'light' | 'dark' | 'auto'
export type ContrastChoice = 'standard' | 'high'

export interface Settings {
  /** The language of the app's text (N5.5). Chosen per device; parts not yet translated show in English. */
  language: string
  textSize: TextSize
  theme: ThemeChoice
  contrast: ContrastChoice
  /** Stops motion whatever the device asks for; the device preference also always applies. */
  reduceMotion: boolean
  /** One column, bigger targets and fewer extras (ACS-01). */
  simple: boolean
  /** Calm mode (XI-01): reduced stimulation, softened colours, one column, simpler wording, no countdowns and at most one suggestion a day. */
  calm: boolean
  /** Show captions or a transcript wherever sound or video has one (ACS-01). */
  captions: boolean
  /** Save data: nothing loads until asked for, no animation, and refreshes come less often (NET-04). */
  dataLight: boolean
  /** Temperatures and lengths in this system (ACT-08). */
  units: Units
  /** Where the guest lives, for the rules that depend on it, such as marketing consent (ACT-08). */
  region: ConsentRegion
  /** When to ask before an optional charge (XT-03). */
  chargeCheck: ChargeCheck
  /** How many unprompted suggestions a day, including none (XA-03). */
  nudgesPerDay: NudgeBudget
  /** The guest agreed to keep their private notes and health details (medical card, access needs, allergy flag, child brief, journal) in their account so every device shows them. Off until they say so. */
  syncPrivate: boolean
}

export const DEFAULT_SETTINGS: Settings = { language: 'en', textSize: DEFAULT_TEXT_SIZE, theme: 'auto', contrast: 'standard', reduceMotion: false, simple: false, calm: false, captions: true, dataLight: false, units: 'imperial', region: 'us', chargeCheck: DEFAULT_CHARGE_CHECK, nudgesPerDay: DEFAULT_NUDGES, syncPrivate: false }

/** Small preferences live in localStorage; structured data goes to IndexedDB. */
export const SETTINGS_KEY = 'princess:settings'

/** Each signed-in person keeps their own settings, so Gerald's Large text does not follow Maria. */
export const settingsKeyFor = (personaId: string | null): string => (personaId ? `${SETTINGS_KEY}:${personaId}` : SETTINGS_KEY)

/** Whether the browser says the person asked for less data ("Data Saver" or similar), so data-light mode starts on (NET-04). */
export function saveDataRequested(nav: unknown = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  const connection = nav && typeof nav === 'object' ? (nav as { connection?: { saveData?: unknown } }).connection : undefined
  return connection?.saveData === true
}

/** What a persona starts with before they change anything: their own default text size (Gerald on Large), and data-light when the device asks for it. */
export const defaultsFor = (persona: { defaultTextSize: TextSize } | null, saveData: boolean = saveDataRequested()): Settings => ({
  ...DEFAULT_SETTINGS,
  textSize: persona?.defaultTextSize ?? DEFAULT_SETTINGS.textSize,
  dataLight: saveData,
})

type ReadStore = Pick<Storage, 'getItem'>
type WriteStore = Pick<Storage, 'setItem'>

/** Settings from untrusted stored data: anything unknown or malformed falls back to the default for that field. */
export function normalizeSettings(raw: unknown, defaults: Settings = DEFAULT_SETTINGS): Settings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    language: isLanguage(o.language) ? o.language : defaults.language,
    textSize: isTextSize(o.textSize) ? o.textSize : defaults.textSize,
    theme: o.theme === 'light' || o.theme === 'dark' || o.theme === 'auto' ? o.theme : defaults.theme,
    contrast: o.contrast === 'high' || o.contrast === 'standard' ? o.contrast : defaults.contrast,
    reduceMotion: typeof o.reduceMotion === 'boolean' ? o.reduceMotion : defaults.reduceMotion,
    simple: typeof o.simple === 'boolean' ? o.simple : defaults.simple,
    calm: typeof o.calm === 'boolean' ? o.calm : defaults.calm,
    captions: typeof o.captions === 'boolean' ? o.captions : defaults.captions,
    dataLight: typeof o.dataLight === 'boolean' ? o.dataLight : defaults.dataLight,
    units: isUnits(o.units) ? o.units : defaults.units,
    region: isConsentRegion(o.region) ? o.region : defaults.region,
    chargeCheck: isChargeCheck(o.chargeCheck) ? o.chargeCheck : defaults.chargeCheck,
    nudgesPerDay: isNudgeBudget(o.nudgesPerDay) ? o.nudgesPerDay : defaults.nudgesPerDay,
    syncPrivate: typeof o.syncPrivate === 'boolean' ? o.syncPrivate : defaults.syncPrivate,
  }
}

/** The settings that belong to the guest's account and follow them between devices; the rest (theme, contrast, text size, motion, data-light) are chosen per device. */
export const SYNCED_FIELDS = ['simple', 'calm', 'captions', 'units', 'region', 'chargeCheck', 'nudgesPerDay', 'syncPrivate'] as const
export type SyncedSettings = Pick<Settings, (typeof SYNCED_FIELDS)[number]>

export const pickSynced = (s: Settings): SyncedSettings => ({ simple: s.simple, calm: s.calm, captions: s.captions, units: s.units, region: s.region, chargeCheck: s.chargeCheck, nudgesPerDay: s.nudgesPerDay, syncPrivate: s.syncPrivate })

/** The account-level fields of a server copy laid over `base`; anything missing or malformed keeps its value from `base`. */
export const withSynced = (base: Settings, raw: unknown): Settings => ({ ...base, ...pickSynced(normalizeSettings(raw, base)) })

/** The saved settings, or the defaults when nothing usable is stored or storage is unavailable. */
export function loadSettings(storage: ReadStore | null = safeStorage(), defaults: Settings = DEFAULT_SETTINGS, key: string = SETTINGS_KEY): Settings {
  try {
    const text = storage?.getItem(key)
    return normalizeSettings(text ? JSON.parse(text) : null, defaults)
  } catch {
    return { ...defaults }
  }
}

/** Saves settings; false when storage refuses (private mode, quota). */
export function saveSettings(settings: Settings, storage: WriteStore | null = safeStorage(), key: string = SETTINGS_KEY): boolean {
  try {
    storage?.setItem(key, JSON.stringify(settings))
    return !!storage
  } catch {
    return false
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** The attributes set on `<html>` for a set of settings; "auto" resolves against the device's colour preference. */
export function settingsToAttributes(s: Settings, deviceIsDark: boolean): Record<'data-theme' | 'data-contrast' | 'data-motion' | 'data-text-size' | 'data-simple' | 'data-calm' | 'data-captions' | 'data-light', string> {
  return {
    'data-theme': s.theme === 'auto' ? (deviceIsDark ? 'dark' : 'light') : s.theme,
    'data-contrast': s.contrast,
    'data-motion': s.reduceMotion || s.calm ? 'reduced' : 'full',
    'data-text-size': s.textSize,
    'data-simple': s.simple ? 'on' : 'off',
    'data-calm': s.calm ? 'on' : 'off',
    'data-captions': s.captions ? 'on' : 'off',
    'data-light': s.dataLight ? 'on' : 'off',
  }
}
