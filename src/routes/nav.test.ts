import { describe, expect, it } from 'vitest'
import { MAX_TAPS, TABS, TOP_TASKS, childLinks, navProblems, routeForPath, tabForPath, type TaskDef } from './nav'
import { ROUTES } from './routes'

describe('navigation model', () => {
  it('has the five tabs and fifteen top tasks', () => {
    expect(TABS.map((t) => t.id)).toEqual(['home', 'plan', 'ship', 'chat', 'me'])
    expect(TOP_TASKS).toHaveLength(15)
  })

  it('keeps every top task within two taps (UX-01) and on real screens', () => {
    expect(navProblems()).toEqual([])
    for (const task of TOP_TASKS) expect(task.taps.length, task.id).toBeLessThanOrEqual(MAX_TAPS)
  })

  it('has unique route paths and every route in a tab or the kit', () => {
    const paths = ROUTES.map((r) => r.path)
    expect(new Set(paths).size).toBe(paths.length)
    for (const r of ROUTES) expect(r.tab !== null || r.path === '/kit' || r.public === true, r.path).toBe(true)
  })

  it('finds the tab for a location, including parameterised screens', () => {
    expect(tabForPath('/')).toBe('home')
    expect(tabForPath('/plan/reservations/abc')).toBe('plan')
    expect(tabForPath('/me/bill')).toBe('me')
    expect(tabForPath('/kit')).toBeNull()
    expect(tabForPath('/nowhere')).toBeNull()
  })

  it('finds a route and the screens below a screen', () => {
    expect(routeForPath('/me/bill')?.titleKey).toBe('route.bill')
    expect(routeForPath('/nowhere')).toBeNull()
    expect(routeForPath('/home/check-in/receipt')?.titleKey).toBe('route.receipt')
    expect(routeForPath('/home/check-in/photo')?.titleKey).toBe('route.checkin')
    expect(tabForPath('/home/embarkation/steps')).toBe('home')
    expect(childLinks('/me').map((r) => r.path)).toEqual(['/me/trips', '/me/profile', '/me/documents', '/me/payments', '/me/notifications', '/me/helper', '/me/help', '/me/contact', '/me/bill', '/me/ledger', '/me/cases', '/me/feedback', '/me/history', '/me/loyalty', '/me/rebook', '/me/privacy', '/me/print', '/me/money', '/me/status', '/me/report-problem', '/me/marketing', '/me/fix-it', '/me/calm', '/me/assist', '/me/wrapped', '/me/memories', '/me/recap', '/me/sustainability', '/me/packages', '/me/settings', '/me/demo'])
    expect(childLinks('/').map((r) => r.path)).toEqual(['/home/boarding-pass', '/home/find-pass', '/home/check-in', '/home/embarkation', '/home/disembark', '/home/cabins', '/home/decide', '/home/offers', '/home/updates', '/home/ask', '/home/briefing', '/home/summary', '/home/disruption', '/home/delayed', '/home/concierge', '/home/cruise', '/home/sailings', '/home/ship', '/home/saved', '/home/quiz', '/home/advisors', '/home/medallion', '/home/luggage', '/home/clearance'])
    expect(childLinks('/plan').map((r) => r.path)).toEqual(['/plan/day', '/plan/reservations', '/plan/excursions', '/plan/dining', '/plan/checklist', '/plan/packing', '/plan/travel', '/plan/party', '/plan/phone', '/plan/family-link', '/plan/split', '/plan/autopilot', '/plan/what-if', '/plan/storm', '/plan/away', '/plan/medical', '/plan/hold', '/plan/access', '/plan/contract', '/plan/readiness', '/plan/allergy', '/plan/shares', '/plan/price-watch', '/plan/ship-packing', '/plan/guarantee', '/plan/money-plan', '/plan/child-story', '/plan/paste', '/plan/starter', '/plan/getting-there', '/plan/assistance', '/plan/ahead', '/plan/clubs', '/plan/prepay', '/plan/cart', '/plan/weather', '/plan/health-prep', '/plan/upgrades'])
    expect(childLinks('/chat')).toEqual([])
  })

  it('would catch a task over the tap budget', () => {
    const tasks = TOP_TASKS as TaskDef[]
    tasks.push({ id: 'tooDeep', labelKey: 'task.textSize', taps: ['/me', '/me/settings', '/me/settings'] })
    try {
      expect(navProblems().some((p) => p.includes('tooDeep'))).toBe(true)
    } finally {
      tasks.pop()
    }
  })
})
