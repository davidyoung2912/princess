import { describe, expect, it } from 'vitest'
import { REDIRECTS, ROUTES } from './routes'

describe('old addresses that forward', () => {
  const known = new Set(ROUTES.map((r) => r.path))
  it('never shadow a real route, and every target is one', () => {
    for (const r of REDIRECTS) {
      expect(known.has(r.from), r.from).toBe(false)
      expect(known.has(r.to.split('?')[0]), r.to).toBe(true)
    }
  })
  it('are not linked from the front end any more', () => {
    const files = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const stray = Object.entries(files)
      .filter(([f]) => !/\.test\.|\/i18n\/locales\/es\.ts|(^|\/)routes\.ts$/.test(f))
      .filter(([, src]) => REDIRECTS.some((r) => src.includes(`'${r.from}'`) || src.includes(`"${r.from}"`) || src.includes(`\`${r.from}`)))
      .map(([f]) => f)
    expect(stray).toEqual([])
  })
})
