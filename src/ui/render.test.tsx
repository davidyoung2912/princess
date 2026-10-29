import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { beforeAll, describe, expect, it } from 'vitest'
import { AppRoutes } from '../App'
import { FAQS } from '../domain/help'
import { t } from '../i18n'
import { tabForPath, TABS, TOP_TASKS } from '../routes/nav'
import { ROUTES } from '../routes/routes'
import { SCREENS } from '../screens'

// Screens load on first visit; load them all first so each renders in a single pass.
beforeAll(async () => {
  await Promise.all(Object.values(SCREENS).map((s) => ('preload' in s ? s.preload() : null)))
})

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

describe('account screens', () => {
  it('reach every account screen from Me in one tap', () => {
    const me = render('/me')
    for (const href of ['/me/trips', '/me/profile', '/me/documents', '/me/payments', '/me/notifications', '/me/helper', '/me/help', '/me/contact', '/me/bill', '/me/packages', '/me/settings']) expect(me).toContain(`href="${href}"`)
    expect(decode(me)).toContain(t('app.conceptNotice'))
  })

  it('lists every help centre answer and a way to reach a person', () => {
    const html = decode(render('/me/help'))
    for (const f of FAQS) expect(html).toContain(f.question)
    expect(html).toContain('href="/me/contact"')
    expect(html).toContain('type="search"')
  })

  it('says plainly when a person is not on the booking, with a way on', () => {
    expect(decode(render('/me/profile/nobody'))).toContain(t('profile.notFound'))
  })

  it('shows a loading note, not an empty page, while a person’s data loads', () => {
    for (const path of ['/me/trips', '/me/documents', '/me/payments', '/me/notifications', '/me/helper', '/me/profile', '/me/contact']) expect(decode(render(path)), path).toContain('role="status"')
  })

  it('keeps one h1 on each account screen', () => {
    for (const route of ROUTES.filter((r) => r.path.startsWith('/me/') && r.phase === 2)) expect(render(route.path.replace(':id', 'sample')).match(/<h1/g), route.path).toHaveLength(1)
  })
})

describe('check-in and boarding screens', () => {
  it('reach the no-sign-in pass finder from Home before anything has loaded', () => {
    const home = render('/')
    for (const href of ['/home/find-pass', '/home/sailings', '/home/cruise']) expect(home).toContain(`href="${href}"`)
  })

  it('shows one h1 and a loading note while a guest’s check-in loads', () => {
    for (const path of ['/home/check-in', '/home/check-in/photo', '/home/check-in/receipt', '/home/boarding-pass', '/home/embarkation', '/home/embarkation/steps']) {
      const html = decode(render(path))
      expect(html.match(/<h1/g), path).toHaveLength(1)
      expect(html, path).toContain('role="status"')
    }
  })

  it('names the step on a step address and the overview on an unknown one', () => {
    expect(decode(render('/home/check-in/photo'))).toContain(`<h1>${t('checkin.step.photo')}</h1>`)
    expect(decode(render('/home/check-in/nonsense'))).toContain(`<h1>${t('route.checkin')}</h1>`)
  })

  it('needs no sign-in to find a pass, and asks only for the booking number and a last name', () => {
    const html = decode(render('/home/find-pass'))
    expect(html).toContain(t('find.number'))
    expect(html).toContain(t('find.lastName'))
  })

  it('explains the terminal fallback before anything else matters, with a way back to online check-in', () => {
    const html = decode(render('/home/check-in/terminal'))
    expect(html).toContain(t('terminal.reassure'))
    expect(html).toContain('href="/home/check-in"')
    expect(html).toContain(t('terminal.blue'))
  })
})

describe('onboard screens', () => {
  it('reaches every top task in the taps the model promises, by a real link on the screen before (Home depends on the booking, so it is checked in the app)', () => {
    for (const task of TOP_TASKS) {
      const steps = task.taps.filter((s) => s !== 'help')
      for (let i = 0; i < steps.length - 1; i++) {
        if (steps[i] === '/' || steps[i + 1].includes(':')) continue
        expect(render(steps[i].replace(':id', 'sample')), `${task.id}: ${steps[i]} → ${steps[i + 1]}`).toContain(`href="${steps[i + 1]}"`)
      }
    }
  })

  it('puts the emergency card and the muster drill first on the Ship tab', () => {
    const html = decode(render('/ship'))
    expect(html.indexOf('href="/ship/emergency"')).toBeLessThan(html.indexOf('href="/ship/map"'))
    expect(html).toContain('href="/ship/muster"')
    expect(html).toContain('href="/ship/venues"')
    expect(html).toContain('href="/ship/port"')
  })

  it('opens the emergency card with the numbers built in, so it shows with no signal', () => {
    const html = decode(render('/ship/emergency'))
    expect(html).toContain(t('emerg.dial'))
    for (const n of ['555-0111', '555-0112', '555-0100']) expect(html).toContain(`href="tel:${n}"`)
    expect(html).toContain(t('emerg.contacts'))
    expect(html).toContain(t('help.urgent.title'))
    expect(html).toContain(t('help.urgent.child'))
  })

  it('shows the deck map as text a screen reader can read, with a table per deck and the lifts', () => {
    const html = decode(render('/ship/map'))
    expect(html).toContain('<table')
    expect(html).toContain('<caption>')
    expect(html).toContain('Princess Arena')
    expect(html).toContain(t('map.noLocation'))
    expect(html).toContain(t('map.search'))
  })

  it('lists every restaurant and bar, and gives a menu with what each dish contains', () => {
    const list = decode(render('/ship/venues'))
    for (const id of ['soleil', 'eclipse', 'crown', 'alfredo', 'intl-cafe']) expect(list).toContain(`href="/ship/venues/${id}"`)
    const one = decode(render('/ship/venues/sabatini'))
    expect(one).toContain('Sabatini’s')
    expect(one).toContain('Veal Milanese')
    expect(one).toContain(t('ven.allergyNote'))
    expect(one).toContain('href="/plan/dining"')
  })

  it('says plainly when a restaurant does not exist, with a way on', () => {
    const html = decode(render('/ship/venues/nowhere'))
    expect(html).toContain(t('ven.gone'))
    expect(html).toContain('href="/ship/venues"')
  })

  it('gives the muster drill in five languages with the right lang on the text', () => {
    const html = decode(render('/ship/muster'))
    for (const name of ['English', 'Español', 'Français', 'Deutsch', '中文']) expect(html).toContain(name)
    expect(html).toContain('lang="en"')
    expect(html).toContain(t('muster.alt'))
  })

  it('offers party chat first with Guest Services one press away, and always shows the phone number', () => {
    const html = decode(render('/chat'))
    expect(html).toContain(t('chat.party'))
    expect(html).toContain(t('chat.service'))
    expect(html).toContain('href="tel:555-0100"')
  })

  it('shows one h1 and a loading note while the planner, bill, reservations and port day load', () => {
    for (const path of ['/plan/reservations', '/plan/reservations/sample', '/ship/port', '/me/bill']) {
      const html = decode(render(path))
      expect(html.match(/<h1/g), path).toHaveLength(1)
      expect(html, path).toContain('role="status"')
    }
  })
})
