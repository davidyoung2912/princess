/** WCAG 2.2 contrast maths, and the colour pairs each theme must keep apart. Pure, so it runs in node. */

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

/** WCAG relative luminance of a `#rrggbb` colour. */
export function luminanceOf(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel(((n >> 16) & 255) / 255) + 0.7152 * channel(((n >> 8) & 255) / 255) + 0.0722 * channel((n & 255) / 255)
}

/** WCAG contrast ratio of two colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Normal text needs 4.5:1 (1.4.3), a control or graphic 3:1 (1.4.11). The high-contrast themes aim for 7:1 text (AAA). */
export const TEXT_MIN = 4.5
export const UI_MIN = 3
export const TEXT_MIN_HIGH = 7

export interface Pair {
  name: string
  fg: string
  bg: string
  /** Kind of use decides the threshold. */
  kind: 'text' | 'ui'
}

const text = (name: string, fg: string, bg: string): Pair => ({ name, fg, bg, kind: 'text' })
const ui = (name: string, fg: string, bg: string): Pair => ({ name, fg, bg, kind: 'ui' })

/** The token pairs the app uses together, as `[foreground token, background token]`. */
export const PAIRS: readonly Pair[] = [
  text('text on page', '--text', '--bg'),
  text('text on warm surface', '--text', '--surface-warm'),
  text('text on info surface', '--text', '--surface-info'),
  text('muted text on page', '--text-muted', '--bg'),
  text('muted text on warm surface', '--text-muted', '--surface-warm'),
  text('muted text on info surface', '--text-muted', '--surface-info'),
  text('link on page', '--link', '--bg'),
  text('link on warm surface', '--link', '--surface-warm'),
  text('label on primary button', '--on-primary', '--primary'),
  text('label on pressed primary button', '--on-primary', '--primary-dark'),
  text('primary text on selected tint', '--primary', '--brand-tint'),
  text('text on selected tint', '--text', '--brand-tint'),
  text('gold text on page', '--gold-text', '--bg'),
  text('gold text on warm surface', '--gold-text', '--surface-warm'),
  text('success on page', '--success', '--bg'),
  text('success on warm surface', '--success', '--surface-warm'),
  text('warning on page', '--warning', '--bg'),
  text('warning on warm surface', '--warning', '--surface-warm'),
  text('danger on page', '--danger', '--bg'),
  text('danger on warm surface', '--danger', '--surface-warm'),
  text('label on attention badge', '--on-attention', '--attention'),
  ui('input and control border on page', '--border-strong', '--bg'),
  ui('control border on warm surface', '--border-strong', '--surface-warm'),
  ui('primary control on page', '--primary', '--bg'),
  ui('focus ring on page', '--focus', '--bg'),
  ui('focus ring on warm surface', '--focus', '--surface-warm'),
  ui('focus ring on primary button', '--focus-inner', '--primary'),
  ui('gold decoration on page', '--gold', '--bg'),
]

export type Palette = Record<string, string>

/** Threshold for a pair in a palette; the high-contrast themes hold text to 7:1. */
export function minFor(pair: Pair, highContrast: boolean): number {
  if (pair.kind === 'ui') return UI_MIN
  return highContrast ? TEXT_MIN_HIGH : TEXT_MIN
}

/** Every failing pair in a palette, as readable lines. */
export function contrastFailures(palette: Palette, highContrast: boolean, label: string): string[] {
  return PAIRS.flatMap((p) => {
    const fg = palette[p.fg]
    const bg = palette[p.bg]
    if (!fg || !bg) return [`${label}: ${p.name} uses a token that is not defined (${p.fg} / ${p.bg})`]
    const min = minFor(p, highContrast)
    const r = contrastRatio(fg, bg)
    return r < min ? [`${label}: ${p.name} is ${r.toFixed(2)}:1, needs ${min}:1`] : []
  })
}
