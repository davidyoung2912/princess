import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTRAST_NAMES, THEME_NAMES, parseRules, resolvePalette } from './palettes'
import { PAIRS, contrastFailures, contrastRatio, luminanceOf } from './contrast'

const css = readFileSync(join(__dirname, '..', 'styles', 'themes.css'), 'utf8')

describe('contrast maths', () => {
  it('matches known WCAG values', () => {
    expect(luminanceOf('#ffffff')).toBeCloseTo(1, 5)
    expect(luminanceOf('#000000')).toBeCloseTo(0, 5)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    // Princess Blue against white: the brand pairing for buttons.
    expect(contrastRatio('#003595', '#ffffff')).toBeGreaterThan(10.7)
    // The brand gold fails as small text on white, which is why --gold-text exists.
    expect(contrastRatio('#aa8247', '#ffffff')).toBeLessThan(4.5)
  })

  it('is symmetric', () => {
    expect(contrastRatio('#003595', '#f2efed')).toBeCloseTo(contrastRatio('#f2efed', '#003595'), 10)
  })
})

describe('contrast guard', () => {
  it('reports a failing pair and a missing token', () => {
    const bad = { ...resolvePalette(css, 'light', 'standard'), '--text': '#cccccc' }
    expect(contrastFailures(bad, false, 'bad').some((l) => l.includes('text on page'))).toBe(true)
    const missing = { ...resolvePalette(css, 'light', 'standard') }
    delete missing['--focus']
    expect(contrastFailures(missing, false, 'x').some((l) => l.includes('not defined'))).toBe(true)
  })

  it('holds high contrast to 7:1 for text but not standard contrast', () => {
    // #6c6c78 (brand steel gray) is 5.2:1 on white: fine for standard text, not for the high-contrast bar.
    const weak = { ...resolvePalette(css, 'light', 'high'), '--text-muted': '#6c6c78' }
    expect(contrastFailures(weak, true, 'hc').some((l) => l.includes('muted text on page'))).toBe(true)
    expect(contrastFailures(weak, false, 'std').some((l) => l.includes('muted text on page'))).toBe(false)
  })
})

describe('theme stylesheet', () => {
  it('parses declarations and selector lists', () => {
    const rules = parseRules(`/* c */ :root, :root[data-theme='light'] { --a: #fff; --b: #000; } :root[data-theme='dark'] { --a: #111; }`)
    expect(rules.get(':root')).toEqual({ '--a': '#fff', '--b': '#000' })
    expect(rules.get(`:root[data-theme='light']`)).toEqual({ '--a': '#fff', '--b': '#000' })
    expect(rules.get(`:root[data-theme='dark']`)).toEqual({ '--a': '#111' })
  })

  it('defines the same tokens in every theme', () => {
    const keys = (t: 'light' | 'dark') => Object.keys(resolvePalette(css, t, 'standard')).sort()
    expect(keys('dark')).toEqual(keys('light'))
    expect(keys('light').length).toBeGreaterThan(20)
  })

  it('uses a #rrggbb value for every colour a pair depends on', () => {
    const used = new Set(PAIRS.flatMap((p) => [p.fg, p.bg]))
    for (const theme of THEME_NAMES) {
      for (const contrast of CONTRAST_NAMES) {
        const palette = resolvePalette(css, theme, contrast)
        for (const token of used) expect(palette[token], `${theme}/${contrast} ${token}`).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })

  for (const theme of THEME_NAMES) {
    for (const contrast of CONTRAST_NAMES) {
      it(`${theme} theme, ${contrast} contrast: every pair meets its minimum`, () => {
        const palette = resolvePalette(css, theme, contrast)
        expect(contrastFailures(palette, contrast === 'high', `${theme}/${contrast}`)).toEqual([])
      })
    }
  }
})
