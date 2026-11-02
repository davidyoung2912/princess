// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { getLocale, setLocale } from '../i18n'
import { applyLanguage, getSettings, updateSettings } from './store'

describe('choosing a language', () => {
  afterEach(() => { updateSettings({ language: 'en', units: 'imperial', unitsChosen: false }); setLocale('en') })

  it('switches the text and the units together, once the language has loaded', async () => {
    const root = { setAttribute: (k: string, v: string) => { attrs[k] = v } } as unknown as HTMLElement
    const attrs: Record<string, string> = {}
    updateSettings({ language: 'es' })
    expect(getSettings().units).toBe('metric')
    await applyLanguage(root)
    expect(getLocale()).toBe('es')
    expect(attrs.lang).toBe('es')
  })

  it('keeps units the guest chose themselves', () => {
    updateSettings({ units: 'metric', unitsChosen: true })
    updateSettings({ language: 'es' })
    updateSettings({ language: 'en' })
    expect(getSettings().units).toBe('metric')
  })
})
