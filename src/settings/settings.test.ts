import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, normalizeSettings, saveSettings, settingsToAttributes } from './settings'

const memory = (initial?: string) => {
  const data = new Map<string, string>(initial === undefined ? [] : [[SETTINGS_KEY, initial]])
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data }
}

describe('normalizeSettings', () => {
  it('keeps valid values', () => {
    const s = { textSize: 'large', theme: 'dark', contrast: 'high', reduceMotion: true }
    expect(normalizeSettings(s)).toEqual(s)
  })

  it('falls back field by field on bad data', () => {
    expect(normalizeSettings({ textSize: 'huge', theme: 7, contrast: null, reduceMotion: 'yes' })).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ textSize: 'large' })).toEqual({ ...DEFAULT_SETTINGS, textSize: 'large' })
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('text')).toEqual(DEFAULT_SETTINGS)
  })

  it('uses the supplied defaults, e.g. a persona who prefers Large text', () => {
    expect(normalizeSettings({}, { ...DEFAULT_SETTINGS, textSize: 'large' }).textSize).toBe('large')
  })
})

describe('load and save', () => {
  it('round-trips', () => {
    const store = memory()
    const s = { ...DEFAULT_SETTINGS, textSize: 'xlarge' as const, contrast: 'high' as const }
    expect(saveSettings(s, store)).toBe(true)
    expect(loadSettings(store)).toEqual(s)
  })

  it('survives corrupt stored text, missing storage and refused writes', () => {
    expect(loadSettings(memory('{not json'))).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(saveSettings(DEFAULT_SETTINGS, null)).toBe(false)
    const refusing = { setItem: () => { throw new Error('quota') } }
    expect(saveSettings(DEFAULT_SETTINGS, refusing)).toBe(false)
  })
})

describe('settingsToAttributes', () => {
  it('resolves auto against the device', () => {
    expect(settingsToAttributes(DEFAULT_SETTINGS, true)['data-theme']).toBe('dark')
    expect(settingsToAttributes(DEFAULT_SETTINGS, false)['data-theme']).toBe('light')
    expect(settingsToAttributes({ ...DEFAULT_SETTINGS, theme: 'light' }, true)['data-theme']).toBe('light')
  })

  it('maps the other settings', () => {
    expect(settingsToAttributes({ textSize: 'large', theme: 'dark', contrast: 'high', reduceMotion: true }, false)).toEqual({
      'data-theme': 'dark', 'data-contrast': 'high', 'data-motion': 'reduced', 'data-text-size': 'large',
    })
  })
})
