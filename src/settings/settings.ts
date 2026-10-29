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
}

export const DEFAULT_SETTINGS: Settings = { textSize: DEFAULT_TEXT_SIZE, theme: 'auto', contrast: 'standard', reduceMotion: false }

/** Small preferences live in localStorage; structured data goes to IndexedDB (later steps). */
export const SETTINGS_KEY = 'princess:settings'

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
  }
}

/** The saved settings, or the defaults when nothing usable is stored or storage is unavailable. */
export function loadSettings(storage: ReadStore | null = safeStorage(), defaults: Settings = DEFAULT_SETTINGS): Settings {
  try {
    const text = storage?.getItem(SETTINGS_KEY)
    return normalizeSettings(text ? JSON.parse(text) : null, defaults)
  } catch {
    return { ...defaults }
  }
}

/** Saves settings; false when storage refuses (private mode, quota). */
export function saveSettings(settings: Settings, storage: WriteStore | null = safeStorage()): boolean {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings))
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
export function settingsToAttributes(s: Settings, deviceIsDark: boolean): Record<'data-theme' | 'data-contrast' | 'data-motion' | 'data-text-size', string> {
  return {
    'data-theme': s.theme === 'auto' ? (deviceIsDark ? 'dark' : 'light') : s.theme,
    'data-contrast': s.contrast,
    'data-motion': s.reduceMotion ? 'reduced' : 'full',
    'data-text-size': s.textSize,
  }
}
