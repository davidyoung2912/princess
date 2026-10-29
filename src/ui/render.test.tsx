import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '../App'
import { t } from '../i18n'
import { tabForPath, TABS } from '../routes/nav'
import { ROUTES } from '../routes/routes'

/** Server-renders a screen at an address, with no browser: catches a screen that throws, or a missing title or landmark. */
const render = (path: string) =>
  renderToString(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )

const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

describe('every screen renders inside the shell', () => {
  for (const route of ROUTES) {
    const path = route.path.replace(':id', 'sample')
    it(`${path}`, () => {
      const html = decode(render(path))
      expect(html).toContain(`<h1`)
      expect(html).toContain(t(route.titleKey))
      expect(html).toContain('class="tabs')
      expect(html).toContain(`>${t('help.button')}<`)
      expect(html).toContain('id="main"')
    })
  }

  it('shows a way back from an unknown address', () => {
    const html = decode(render('/nowhere'))
    expect(html).toContain(t('shell.notFound.title'))
    expect(html).toContain(t('shell.notFound.home'))
  })

  it('has five labelled tabs and marks only the current one', () => {
    for (const tab of TABS) {
      const html = render(tab.path)
      expect(html.match(/aria-current="page"/g) ?? []).toHaveLength(1)
      for (const other of TABS) expect(html).toContain(t(other.labelKey))
      expect(tabForPath(tab.path)).toBe(tab.id)
    }
  })

  it('shows the concept notice on Home and Me only', () => {
    for (const route of ROUTES) {
      const html = decode(render(route.path.replace(':id', 'sample')))
      expect(html.includes(t('app.conceptNotice')), route.path).toBe(!!route.notice)
    }
  })

  it('has no tab marked on screens outside the five areas', () => {
    expect(render('/kit').match(/aria-current="page"/g) ?? []).toHaveLength(0)
  })
})

describe('discover screens', () => {
  it('reach every discover screen from Home in one or two taps', () => {
    const home = render('/')
    for (const href of ['/home/sailings', '/home/cruise', '/home/ship', '/home/saved', '/home/ports/cozumel', '/home/ports/belize', '/home/ports/roatan']) expect(home).toContain(`href="${href}"`)
    expect(decode(render('/home/sailings'))).toContain(t('discover.loading'))
  })

  it('shows a real sailing, port and ship, each with an h1 and a way to save', () => {
    const sailing = decode(render('/home/sailings/sun-2027-03-21'))
    expect(sailing).toContain('<h1>Mar 21 to Mar 28, 2027</h1>')
    expect(sailing).toContain('Day 4')
    for (const path of ['/home/ports/belize', '/home/ship']) expect(decode(render(path))).toContain('aria-pressed')
  })

  it('says plainly when a sailing or port does not exist, with a way on', () => {
    expect(decode(render('/home/ports/mars'))).toContain(t('discover.notFound.port'))
    expect(decode(render('/home/sailings/never'))).toContain(t('discover.notFound.sailing'))
  })

  it('puts the tender warning and access note on the Belize page before the rest', () => {
    const html = decode(render('/home/ports/belize'))
    expect(html).toContain(t('discover.tender'))
    expect(html.indexOf(t('discover.gettingAshore'))).toBeLessThan(html.indexOf(t('discover.thingsToDo')))
  })
})
