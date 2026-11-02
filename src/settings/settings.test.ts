import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SETTINGS_KEY, defaultsFor, loadSettings, normalizeSettings, saveSettings, settingsKeyFor, settingsToAttributes, saveDataRequested } from './settings'

const memory = (initial?: string) => {
  const data = new Map<string, string>(initial === undefined ? [] : [[SETTINGS_KEY, initial]])
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data }
}

describe('normalizeSettings', () => {
  it('keeps valid values', () => {
    const s = { language: 'es', textSize: 'large', theme: 'dark', contrast: 'high', reduceMotion: true, simple: true, calm: false, captions: false, dataLight: true, units: 'metric', region: 'uk', chargeCheck: 'always', nudgesPerDay: 0, syncPrivate: true }
    expect(normalizeSettings(s)).toEqual(s)
  })

  it('falls back field by field on bad data', () => {
    expect(normalizeSettings({ textSize: 'huge', theme: 7, contrast: null, reduceMotion: 'yes', simple: 1, captions: 'no', dataLight: 'yes', units: 'miles', region: 'mars' })).toEqual(DEFAULT_SETTINGS)
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
    expect(settingsToAttributes({ language: 'en', textSize: 'large', theme: 'dark', contrast: 'high', reduceMotion: true, simple: true, calm: false, captions: false, dataLight: true, units: 'metric', region: 'uk', chargeCheck: 'always', nudgesPerDay: 0, syncPrivate: false }, false)).toEqual({
      'data-theme': 'dark', 'data-contrast': 'high', 'data-motion': 'reduced', 'data-text-size': 'large', 'data-simple': 'on', 'data-calm': 'off', 'data-captions': 'off', 'data-light': 'on',
    })
  })
})

describe('calm mode', () => {
  it('turns motion off whatever the other setting says, and shows in an attribute', () => {
    const a = settingsToAttributes({ ...DEFAULT_SETTINGS, calm: true }, false)
    expect(a['data-calm']).toBe('on')
    expect(a['data-motion']).toBe('reduced')
    expect(settingsToAttributes(DEFAULT_SETTINGS, false)['data-motion']).toBe('full')
  })
  it('is off by default and read safely', () => {
    expect(DEFAULT_SETTINGS.calm).toBe(false)
    expect(normalizeSettings({ calm: true }).calm).toBe(true)
    expect(normalizeSettings({ calm: 'yes' }).calm).toBe(false)
  })
})

describe('per-person settings', () => {
  it('starts a person on the text size they are given and everyone else on standard, until they choose', () => {
    const m = new Map<string, string>()
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
    const gerald = defaultsFor({ defaultTextSize: 'large' })
    expect(loadSettings(store, gerald, settingsKeyFor('gerald')).textSize).toBe('large')
    expect(loadSettings(store, defaultsFor({ defaultTextSize: 'standard' }), settingsKeyFor('maria')).textSize).toBe('standard')
    saveSettings({ ...gerald, textSize: 'xlarge' }, store, settingsKeyFor('gerald'))
    expect(loadSettings(store, gerald, settingsKeyFor('gerald')).textSize).toBe('xlarge')
    expect(loadSettings(store, defaultsFor({ defaultTextSize: 'standard' }), settingsKeyFor('maria')).textSize).toBe('standard')
  })
})

describe('save-data signal (NET-04)', () => {
  it('reads the browser’s request for less data', () => {
    expect(saveDataRequested({ connection: { saveData: true } })).toBe(true)
    expect(saveDataRequested({ connection: { saveData: false } })).toBe(false)
    expect(saveDataRequested({})).toBe(false)
    expect(saveDataRequested(undefined)).toBe(false)
  })

  it('starts data-light on only when asked, and a saved choice still wins', () => {
    expect(defaultsFor(null, true).dataLight).toBe(true)
    expect(defaultsFor(null, false).dataLight).toBe(false)
    const store = { getItem: () => JSON.stringify({ dataLight: false }) }
    expect(loadSettings(store, defaultsFor(null, true)).dataLight).toBe(false)
    expect(loadSettings({ getItem: () => null }, defaultsFor(null, true)).dataLight).toBe(true)
  })
})

describe('charge check and suggestions settings (XT-03, XA-03)', () => {
  it('start at "more than $50" and three suggestions a day', () => {
    expect(DEFAULT_SETTINGS.chargeCheck).toBe('over50')
    expect(DEFAULT_SETTINGS.nudgesPerDay).toBe(3)
  })

  it('keep a valid choice and fall back on anything else', () => {
    expect(normalizeSettings({ chargeCheck: 'always', nudgesPerDay: 0 })).toMatchObject({ chargeCheck: 'always', nudgesPerDay: 0 })
    expect(normalizeSettings({ chargeCheck: 'sometimes', nudgesPerDay: 7 })).toMatchObject({ chargeCheck: 'over50', nudgesPerDay: 3 })
    expect(normalizeSettings({ chargeCheck: 5, nudgesPerDay: '1' })).toMatchObject({ chargeCheck: 'over50', nudgesPerDay: 3 })
  })
})
