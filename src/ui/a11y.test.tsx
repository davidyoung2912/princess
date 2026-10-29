import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { beforeAll, describe, expect, it } from 'vitest'
import { AppRoutes } from '../App'
import { ROUTES } from '../routes/routes'
import { SCREENS } from '../screens'

beforeAll(async () => {
  await Promise.all(Object.values(SCREENS).map((s) => ('preload' in s ? s.preload() : null)))
})

const render = (path: string) =>
  renderToString(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )

const strip = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()

/** Structural accessibility checks on the first paint of every screen (WCAG 1.1.1, 1.3.1, 2.4.1, 2.4.2, 4.1.2). Colour contrast is covered by the contrast test; keyboard behaviour by the dialog tests. */
describe('accessibility audit of every screen', () => {
  for (const route of ROUTES) {
    const path = route.path.replace(':id', 'sample')
    it(path, () => {
      const html = render(path)

      expect(html.match(/<h1[\s>]/g), 'exactly one h1').toHaveLength(1)
      expect(html.match(/<main[\s>]/g), 'one main landmark').toHaveLength(1)
      expect(html).toContain('class="skip-link"')

      const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
      expect(ids.filter((id, i) => ids.indexOf(id) !== i), 'duplicate ids').toEqual([])
      for (const [, target] of html.matchAll(/aria-labelledby="([^"]+)"/g)) {
        for (const id of target.split(' ')) expect(ids, `aria-labelledby points at missing ${id}`).toContain(id)
      }

      for (const img of html.match(/<img\b[^>]*>/g) ?? []) expect(img, 'image without alt').toMatch(/\salt="/)

      for (const [tag, , inner] of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
        const named = /aria-label="[^"]+"/.test(tag) || strip(inner) !== ''
        expect(named, `button with no name: ${tag.slice(0, 120)}`).toBe(true)
      }
      for (const [tag, , inner] of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
        const named = /aria-label="[^"]+"/.test(tag) || strip(inner) !== ''
        expect(named, `link with no name: ${tag.slice(0, 120)}`).toBe(true)
      }

      const wrapped = (html.match(/<label\b[\s\S]*?<\/label>/g) ?? []).join('')
      for (const input of html.match(/<(input|select|textarea)\b[^>]*>/g) ?? []) {
        if (/type="(hidden|submit|button)"/.test(input)) continue
        const id = input.match(/\sid="([^"]+)"/)?.[1]
        const labelled = /aria-label(ledby)?="[^"]+"/.test(input) || wrapped.includes(input) || (id !== undefined && html.includes(`for="${id}"`))
        expect(labelled, `form field with no label: ${input.slice(0, 120)}`).toBe(true)
      }
    })
  }
})
