import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The hover rule for card-like surfaces (docs: CLAUDE.md, "hover effect only where there is something to press"). A surface that is the click target lifts 2px and takes
 * the deep shadow `var(--elev-3)`; a surface with controls inside takes the same shadow without moving, from the one live-surface rule in components.css. So any hover or
 * focus-within rule that sets a shadow or a lift must use that shadow and that lift. Small controls (buttons, chips, icons, avatars, game cells, chat bubbles) have
 * their own glows and are listed below by the class they use. A new surface rule that does not follow the shared tokens fails here, with the selector to fix.
 */

const dir = join(__dirname)
const files = readdirSync(dir).filter((f) => f.endsWith('.css'))

interface Rule { file: string; selector: string; body: string }

/** Every plain style rule, with comments and @keyframes removed. Rules nested in @media are read as plain rules, which is what the checks need. */
function rules(): Rule[] {
  const out: Rule[] = []
  for (const file of files) {
    const css = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = m[1].trim().replace(/\s+/g, ' ')
      if (!selector.startsWith('@')) out.push({ file, selector, body: m[2].replace(/\s+/g, ' ') })
    }
  }
  return out
}

/** Controls and small parts that keep their own glow: a selector that mentions one of these is not a card-like surface. */
const CONTROLS = [
  '.btn', '.icon-btn', '.chip', '.helptip', '.topbar', '.tabs__', '.testbar', '.welcome__stage', '.me-avatar', '.tabs__logo', '.link-list', '.avatar-picker', '.diet-mark', '.dish-save',
  '.sd-tool', '.sd-digit', '.cw-key', '.wd-key', '.game-help', '.stanley-arc', '.guide-icon', '.stanley__log', '.chat-', '.conv__avatar', '.ai-msg', '.naut-jump', '.exp-split',
  'input[type', 'label:hover',
]

const hoverRules = () => rules().filter((r) => /:hover|:focus-within/.test(r.selector) && !CONTROLS.some((c) => r.selector.includes(c)))
const sets = (r: Rule, what: RegExp) => what.test(r.body)

describe('hover rules for card-like surfaces', () => {
  it('finds the hover rules it is meant to check', () => {
    expect(hoverRules().length).toBeGreaterThan(5)
  })

  it('give every shadow the shared deep shadow', () => {
    const bad = hoverRules().filter((r) => sets(r, /(?:^|[ ;])(?:box-shadow|--card-shadow):/) && !/var\(--elev-3\)|box-shadow: none|--card-shadow: none/.test(r.body))
    expect(bad.map((r) => `${r.file}: ${r.selector}`)).toEqual([])
  })

  it('lift 2px and never scale a surface', () => {
    const bad = hoverRules().filter((r) => sets(r, /transform:\s*(?!none)[^;]*(?:translate|scale)/) && !/transform:\s*translateY\(-2px\)\s*(?:;|$)/.test(r.body))
    expect(bad.map((r) => `${r.file}: ${r.selector}`)).toEqual([])
  })

  it('keep the one live-surface rule that covers the cards and panels', () => {
    const live = rules().find((r) => r.selector.includes(':has(') && r.selector.includes(':is(:hover, :focus-within)') && r.body.includes('var(--elev-3)'))
    expect(live).toBeDefined()
    for (const surface of ['.card', '.banner', '.tip', '.stanley-card', '.chat-card', '.slot-card', '.dish']) expect(live?.selector).toContain(surface)
    for (const role of ['a[href]', 'button:not(:disabled)', 'input:not', 'select', 'textarea', 'summary', "[role='button']"]) expect(live?.selector).toContain(role)
  })

  it('leave nothing-to-press surfaces still: no hover rule sets a lift without a click target', () => {
    // A lift is only for a surface that is itself pressed: a list row, tile or button-like box. Plain `.card` never lifts except the linked grid cards and stage tiles.
    const lifted = hoverRules().filter((r) => /translateY\(-2px\)/.test(r.body)).flatMap((r) => r.selector.split(',').map((s) => s.trim()))
    const plainCard = lifted.filter((s) => /^\.card(?::|$)/.test(s))
    expect(plainCard).toEqual([])
  })
})
