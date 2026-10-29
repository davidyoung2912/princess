import { DEFAULT_TEXT_SIZE, isTextSize, type TextSize } from '../design/textSize'

/** How the guest chose the colour theme; "auto" follows the device. */
export type ThemeChoice = 'light' | 'dark' | 'auto'
export type ContrastChoice = 'standard' | 'high'

export interface Settings {
  textSize: TextSize
  theme: ThemeChoice
  contrast: ContrastChoice
  /** Stops motion whatever the device asks for; the device preference also always applies. */
  reduceMotion: boolean
  /** One column, bigger targets and fewer extras (ACS-01). */
  simple: boolean
  /** Show captions or a transcript wherever sound or video has one (ACS-01). */
  captions: boolean
  /** Save data: nothing loads until asked for, no animation, and refreshes come less often (NET-04). */
  dataLight: boolean
}

export const DEFAULT_SETTINGS: Settings = { textSize: DEFAULT_TEXT_SIZE, theme: 'auto', contrast: 'standard', reduceMotion: false, simple: false, captions: true, dataLight: false }

/** Small preferences live in localStorage; structured data goes to IndexedDB. */
export const SETTINGS_KEY = 'princess:settings'

/** Each signed-in person keeps their own settings, so Gerald's Large text does not follow Maria. */
export const settingsKeyFor = (personaId: string | null): string => (personaId ? `${SETTINGS_KEY}:${personaId}` : SETTINGS_KEY)

/** What a persona starts with before they change anything: their own default text size (Gerald on Large). */
export const defaultsFor = (persona: { defaultTextSize: TextSize } | null): Settings => ({ ...DEFAULT_SETTINGS, textSize: persona?.defaultTextSize ?? DEFAULT_SETTINGS.textSize })

type ReadStore = Pick<Storage, 'getItem'>
type WriteStore = Pick<Storage, 'setItem'>

/** Settings from untrusted stored data: anything unknown or malformed falls back to the default for that field. */
export function normalizeSettings(raw: unknown, defaults: Settings = DEFAULT_SETTINGS): Settings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    textSize: isTextSize(o.textSize) ? o.textSize : defaults.textSize,
    theme: o.theme === 'light' || o.theme === 'dark' || o.theme === 'auto' ? o.theme : defaults.theme,
    contrast: o.contrast === 'high' || o.contrast === 'standard' ? o.contrast : defaults.contrast,
    reduceMotion: typeof o.reduceMotion === 'boolean' ? o.reduceMotion : defaults.reduceMotion,
    simple: typeof o.simple === 'boolean' ? o.simple : defaults.simple,
    captions: typeof o.captions === 'boolean' ? o.captions : defaults.captions,
    dataLight: typeof o.dataLight === 'boolean' ? o.dataLight : defaults.dataLight,
  }
}

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
export function settingsToAttributes(s: Settings, deviceIsDark: boolean): Record<'data-theme' | 'data-contrast' | 'data-motion' | 'data-text-size' | 'data-simple' | 'data-captions' | 'data-light', string> {
  return {
    'data-theme': s.theme === 'auto' ? (deviceIsDark ? 'dark' : 'light') : s.theme,
    'data-contrast': s.contrast,
    'data-motion': s.reduceMotion ? 'reduced' : 'full',
    'data-text-size': s.textSize,
    'data-simple': s.simple ? 'on' : 'off',
    'data-captions': s.captions ? 'on' : 'off',
    'data-light': s.dataLight ? 'on' : 'off',
  }
}
