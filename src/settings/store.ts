import { defaultsFor, loadSettings, pickSynced, saveSettings, settingsKeyFor, settingsToAttributes, SYNCED_FIELDS, unitsAfterLanguageChange, withSynced, type Settings, type SyncedSettings } from './settings'
import { getLocale, loadLocale, setLocale } from '../i18n'
import { sync } from '../sync'
import type { Person } from '../domain/people'

let defaults: Settings = defaultsFor(null)
let current: Settings = loadSettings(undefined, defaults)
let key = settingsKeyFor(null)
/** The id the sync module knows this person's device copy by (their persona id or user id, or null). */
let syncId: string | null = null
const listeners = new Set<() => void>()
let darkQuery: MediaQueryList | null = null

export const getSettings = (): Settings => current

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Writes the settings to `<html>` before first render so there is no flash of the wrong size or theme. */
export function applySettings(root: HTMLElement = document.documentElement): void {
  const dark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  for (const [name, value] of Object.entries(settingsToAttributes(current, dark))) root.setAttribute(name, value)
  const meta = document.querySelector('meta[name="theme-color"]')
  // The browser chrome follows the page: Princess Blue in light themes, the dark page colour in dark ones.
  if (meta) meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#020215' : '#003595')
}

/** Loads and switches to the chosen language, and marks `<html lang>` so screen readers pronounce the text correctly. English stays if the download fails. */
export async function applyLanguage(root: HTMLElement = document.documentElement): Promise<void> {
  const want = current.language
  if (want !== getLocale() && await loadLocale(want) && current.language === want) setLocale(want)
  root.setAttribute('lang', getLocale())
}

/** Changes some settings, saves them, applies them and tells subscribers. */
export function updateSettings(patch: Partial<Settings>): void {
  // Changing the language also moves the units to that language's usual ones, unless the guest chose units themselves.
  if (patch.language !== undefined && patch.language !== current.language && patch.units === undefined) patch = { ...patch, units: unitsAfterLanguageChange(patch.language, current.unitsChosen, current.units) }
  current = { ...current, ...patch }
  saveSettings(current, undefined, key)
  applySettings()
  listeners.forEach((l) => l())
  if ('language' in patch) void applyLanguage()
  if (SYNCED_FIELDS.some((f) => f in patch)) sync.changed('settings', syncId)
}

/** The account-level settings, as sent to the server. */
export const getSyncedSettings = (): SyncedSettings => pickSynced(current)

/** True while the account-level settings are still what a new person starts with, so there is nothing to send. */
export const syncedSettingsAreDefault = (): boolean => SYNCED_FIELDS.every((f) => current[f] === defaults[f])

/** Takes the server's copy of the account-level settings (null: back to the defaults) without telling the sync module. */
export function applySyncedSettings(raw: unknown): void {
  current = withSynced(current, raw === null ? defaults : raw)
  saveSettings(current, undefined, key)
  applySettings()
  listeners.forEach((l) => l())
}

/** Switches to a person's own settings (their saved ones, or their defaults), applies them and tells subscribers. Null is signed out. */
export function switchSettingsOwner(persona: Pick<Person, 'id' | 'defaultTextSize'> | null, ownerId: string | null = persona?.id ?? null): void {
  key = settingsKeyFor(ownerId)
  syncId = ownerId
  defaults = defaultsFor(persona)
  current = loadSettings(undefined, defaults, key)
  applySettings()
  listeners.forEach((l) => l())
  void applyLanguage()
}

/** Puts the current person's settings back to what they started with (used by "Wipe everything"). */
export function resetSettingsToDefaults(): void {
  current = { ...defaults }
  applySettings()
  listeners.forEach((l) => l())
}

/** Follows the device's light/dark switch while the guest has chosen "auto". */
export function watchDeviceTheme(): () => void {
  if (typeof matchMedia !== 'function') return () => {}
  darkQuery = matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => { if (current.theme === 'auto') applySettings() }
  darkQuery.addEventListener('change', onChange)
  return () => darkQuery?.removeEventListener('change', onChange)
}
