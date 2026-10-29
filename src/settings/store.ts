import { DEFAULT_SETTINGS, defaultsFor, loadSettings, saveSettings, settingsKeyFor, settingsToAttributes, type Settings } from './settings'
import type { Persona } from '../domain/personas'

let current: Settings = loadSettings()
let key = settingsKeyFor(null)
let defaults: Settings = DEFAULT_SETTINGS
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

/** Changes some settings, saves them, applies them and tells subscribers. */
export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch }
  saveSettings(current, undefined, key)
  applySettings()
  listeners.forEach((l) => l())
}

/** Switches to a person's own settings (their saved ones, or their defaults), applies them and tells subscribers. Null is signed out. */
export function switchSettingsOwner(persona: Pick<Persona, 'id' | 'defaultTextSize'> | null): void {
  key = settingsKeyFor(persona?.id ?? null)
  defaults = defaultsFor(persona)
  current = loadSettings(undefined, defaults, key)
  applySettings()
  listeners.forEach((l) => l())
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
