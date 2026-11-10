import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Accessibility audit of every Stanley surface (docs/stanley-gap-analysis-and-plan.md, phase 14 follow-up), as a source-level check, because the project does no browser testing. It looks for the
 * faults that can be found in the markup alone (WCAG 2.2 AA: 1.1.1, 1.3.1, 2.1.1, 2.4.3, 2.5.8, 4.1.2, 4.1.3). It cannot judge focus order in a rendered page, a screen reader's reading, or colour as drawn;
 * the existing screen tests check structure and contrast, and a person still needs to try Stanley with a screen reader and a keyboard before a release.
 */
const DIR = 'src/ui/ai'
const files = readdirSync(DIR).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx')).map((f) => join(DIR, f))
const src = (f: string): string => readFileSync(f, 'utf8')
/** Each opening tag of one of the named elements, as written (a tag may span lines; `=>` inside an attribute is not the end of the tag). */
const tags = (text: string, names: string): string[] => [...text.matchAll(new RegExp(`<(?:${names})\\b(?:[^>]|=>)*>`, 'g'))].map((m) => m[0])
/** Controls with no name of their own: no aria-label, no id for a label to point at, and not written inside a label element. */
const unnamed = (text: string): string[] =>
  [...text.matchAll(/<(?:input|textarea|select)\b(?:[^>]|=>)*>/g)]
    .filter((m) => {
      const before = text.slice(0, m.index)
      const inLabel = before.lastIndexOf('<label') > before.lastIndexOf('</label>')
      return !inLabel && !/\baria-label(ledby)?=|\bid=/.test(m[0]) && !/type=["']hidden/.test(m[0])
    })
    .map((m) => m[0])

describe('Stanley surfaces: accessibility audit', () => {
  it('finds the surfaces it is meant to audit', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('puts no click handler on an element a keyboard cannot reach', () => {
    const bad = files.flatMap((f) => tags(src(f), 'div|span|p|li|ul|section|article|img|h[1-6]|small').filter((t) => /\bonClick=/.test(t)).map((t) => `${f}: ${t.slice(0, 60)}`))
    expect(bad).toEqual([])
  })

  it('gives every image alt text (empty for decoration)', () => {
    const bad = files.flatMap((f) => tags(src(f), 'img').filter((t) => !/\balt=/.test(t)).map((t) => `${f}: ${t.slice(0, 60)}`))
    expect(bad).toEqual([])
  })

  it('never needs hover to reach something, and never sets a positive tab order', () => {
    const bad = files.filter((f) => /onMouseEnter|onMouseOver|onPointerEnter|onMouseLeave/.test(src(f)) || /tabIndex=\{?["']?[1-9]/.test(src(f)))
    expect(bad).toEqual([])
  })

  it('names every raw form control and every link that opens a new tab', () => {
    const controls = files.flatMap((f) => unnamed(src(f)).map((t) => `${f}: ${t.slice(0, 60)}`))
    expect(controls).toEqual([])
    const links = files.flatMap((f) => tags(src(f), 'a').filter((t) => /target=["']_blank/.test(t) && !/rel=["'][^"']*noopener/.test(t)).map((t) => `${f}: ${t.slice(0, 60)}`))
    expect(links).toEqual([])
    const dead = files.filter((f) => /href=["']#["']|href=["']javascript:/.test(src(f)))
    expect(dead).toEqual([])
  })

  it('leaves the page heading to the screen: no surface here draws an h1', () => {
    expect(files.filter((f) => /<h1\b/.test(src(f)))).toEqual([])
  })

  it('draws a dialog only through the shared dialog code (which traps focus and closes on Escape)', () => {
    expect(files.filter((f) => /role=["']dialog["']|aria-modal/.test(src(f)) && !/\buseDialog(?:<[^>]*>)?\(/.test(src(f)))).toEqual([])
  })

  it('announces what arrives after the guest has acted or the page has loaded, in the surfaces that fetch', () => {
    for (const f of ['StanleyChanges', 'StanleyOpsConsole', 'StanleyDialog', 'StanleyActionCard', 'HandoffCard', 'StanleyMoney', 'StanleyTravel']) {
      expect(src(join(DIR, `${f}.tsx`)), f).toMatch(/aria-live=|role=["'](status|alert)["']/)
    }
  })

  it('does not rely on colour alone for the state of a change card or an action', () => {
    // A state is written as words as well: the card says Verified, Provisional or Forecast, and an action says what it did.
    expect(src(join(DIR, 'StanleyChanges.tsx'))).toMatch(/ch11\.status\./)
  })

  it('keeps Stanley\'s animation behind the reduced-motion setting', () => {
    const css = ['src/styles/concierge.css', 'src/styles/motion.css'].map((f) => readFileSync(f, 'utf8')).join('\n')
    expect(css).toMatch(/prefers-reduced-motion/)
  })

  it('keeps voice optional and under the guest\'s hand: pressed state, a status while listening, and no speech that starts by itself', () => {
    const voice = src(join(DIR, 'StanleyVoice.tsx'))
    expect(voice).toMatch(/aria-pressed=/)
    expect(voice).toMatch(/role=["']status["']/)
    // Speech is only started from a button handler, never from an effect.
    expect(voice).not.toMatch(/useEffect\([^)]*speak\(/)
    expect(src(join(DIR, 'StanleyDialog.tsx'))).toMatch(/<MicButton/)
  })

  it('lets the pocket card be printed on its own, with a large-print choice', () => {
    const voice = src(join(DIR, 'StanleyVoice.tsx'))
    expect(voice).toMatch(/<PrintCard/)
    expect(voice).toMatch(/stanley\.pocket\.large/)
  })
})
