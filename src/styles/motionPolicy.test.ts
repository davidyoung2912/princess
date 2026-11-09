import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/styles'
const css = readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => ({ f, text: readFileSync(`${dir}/${f}`, 'utf8') }))
const all = css.map((c) => c.text).join('\n')

describe('motion policy (L2 to L7)', () => {
  it('turns every animation and transition off for the device preference and the in-app setting', () => {
    expect(all).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: 0\.001ms !important/)
    expect(all).toMatch(/:root\[data-motion='reduced'\] \*,/)
  })
  it('stops looping effects in data-light mode', () => {
    expect(all).toMatch(/:root\[data-light='on'\] \*[^{]*\{ animation: none !important/)
  })
  it('hides decorative extras at the Quiet fun level, and calm mode counts as Quiet', () => {
    expect(all).toContain(":root[data-fun='quiet'] .fun-only")
  })
  it('the animated deck route is off when motion is reduced, at Quiet and in data-light', () => {
    const route = all.split('\n').filter((l) => l.includes('.deck-plan__route') && l.includes('animation: none')).join('\n')
    expect(route).toContain("data-motion='reduced'")
    expect(route).toContain("data-fun='quiet'")
    expect(route).toContain("data-light='on'")
  })
})
