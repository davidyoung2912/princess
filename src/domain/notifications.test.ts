import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, EXPLORER_LEADS, normalizePrefs } from './notifications'

describe('the Explorer reminder lead time', () => {
  it('defaults to 15 minutes', () => {
    expect(DEFAULT_PREFS.explorerLead).toBe(15)
    expect(normalizePrefs(undefined).explorerLead).toBe(15)
  })

  it('keeps every offered choice, including off', () => {
    for (const m of EXPLORER_LEADS) expect(normalizePrefs({ explorerLead: m }).explorerLead).toBe(m)
    expect(normalizePrefs({ explorerLead: 0 }).explorerLead).toBe(0)
  })

  it('falls back to the default for anything else', () => {
    for (const bad of [7, -5, '30', null, NaN]) expect(normalizePrefs({ explorerLead: bad }).explorerLead).toBe(15)
  })
})
