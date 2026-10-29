import type { Palette } from './contrast.ts'

export type ThemeName = 'light' | 'dark'
export type ContrastName = 'standard' | 'high'

/** Reads the `--token: value;` declarations out of every rule in a stylesheet, keyed by selector. */
export function parseRules(css: string): Map<string, Palette> {
  const rules = new Map<string, Palette>()
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls: Palette = {}
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) decls[d[1]] = d[2].trim()
    // A rule's selector list shares the declarations (e.g. `:root, :root[data-theme='light']`).
    for (const sel of m[1].split(',')) {
      const key = sel.trim()
      rules.set(key, { ...rules.get(key), ...decls })
    }
  }
  return rules
}

/** The effective palette for a theme and contrast level, merging the base rule and any high-contrast overrides. */
export function resolvePalette(css: string, theme: ThemeName, contrast: ContrastName): Palette {
  const rules = parseRules(css)
  const base = rules.get(`:root[data-theme='${theme}']`) ?? {}
  const high = contrast === 'high' ? rules.get(`:root[data-theme='${theme}'][data-contrast='high']`) ?? {} : {}
  return { ...base, ...high }
}

export const THEME_NAMES: readonly ThemeName[] = ['light', 'dark']
export const CONTRAST_NAMES: readonly ContrastName[] = ['standard', 'high']
