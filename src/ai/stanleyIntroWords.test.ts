import { describe, expect, it } from 'vitest'
import { enCore as en } from '../i18n/locales/enCore'

describe('the Stanley welcome and capability words', () => {
  const entries = Object.entries(en).filter(([k]) => k.startsWith('stanleyIntro.') || k.startsWith('stanleyCan.') || k === 'route.stanleyCan' || k.startsWith('screen.M43.'))
  it('has them', () => expect(entries.length).toBeGreaterThan(15))
  it('never says "AI" as a word (D1)', () => {
    for (const [k, v] of entries) expect(v, k).not.toMatch(/\bAI\b/)
  })
})
