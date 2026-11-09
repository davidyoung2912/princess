import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { beforeAll, describe, expect, it } from 'vitest'
import { isPublicPath } from '../routes/routes'
import { SCREENS } from '../screens'
import { AppRoutes } from '../App'

beforeAll(async () => { await Promise.all(Object.values(SCREENS).map((s) => ('preload' in s ? s.preload() : null))) })

const page = (path: string): string => renderToString(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>)

describe('who needs to sign in (N6.1)', () => {
  it('opens the trial day, the family page and the shared view without an account, and nothing near them', () => {
    expect(isPublicPath('/trial-day')).toBe(true)
    expect(isPublicPath('/at-sea/a.b.c.d')).toBe(true)
    expect(isPublicPath('/shared/abc')).toBe(true)
    expect(isPublicPath('/trial-days')).toBe(false)
    expect(isPublicPath('/trial-day-other')).toBe(false)
    expect(isPublicPath('/at-sea')).toBe(false)
    expect(isPublicPath('/home/quiz')).toBe(false)
    expect(isPublicPath('/me/bill')).toBe(false)
    expect(isPublicPath('/')).toBe(false)
  })
})

describe('clear-to-use sentences (N6)', () => {
  it('trial day: a visitor can pick a day and a mood and is told nothing is kept or booked, with no account needed', () => {
    const html = page('/trial-day')
    expect(html).toContain('A Day on This Ship')
    expect(html).toContain('You do not need an account')
    expect(html).toContain('not saved')
    expect(html).toContain('nothing is booked')
    expect(html).toContain('Sign in to Plan Your Own Days')
    expect(html).toContain('id="main"')
  })

  it('meeting-point card: it starts as a drop-off card with the address and a landmark in words', () => {
    const html = page('/home/meeting-point')
    expect(html).toContain('Meeting-Point Card')
    expect(html).toContain('Drop-off at the cruise terminal')
    expect(html).toContain('1850 Eller Drive')
    expect(html).toContain('Copy the Card')
    // The tip's small round face of Stanley is decoration, not a picture of the meeting point.
    expect(html.split('<main')[1].replace(/<img class="(tip__icon|stanley-card__face)"[^>]*>/g, '')).not.toContain('<img')
  })
})
