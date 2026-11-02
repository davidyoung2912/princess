// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderAt, signInAs, stubNetwork, teardown, type Fixtures } from '../testing/harness'
import { SERVER } from '../testing/fixtures'
import { DEFAULT_PREFS } from '../domain/notifications'

/**
 * N3.1 to N3.6 on the screens: the permission is asked for only on a tap and in plain words, the screen tells the truth about what this browser can do, the
 * log shows what was sent and held back and why, and the calendar address is shown once. The server and the browser are stand-ins; no browser is involved.
 */
afterEach(() => { teardown(); Reflect.deleteProperty(window, 'PushManager'); Reflect.deleteProperty(navigator, 'serviceWorker'); vi.restoreAllMocks() })

const STATUS = { available: true, publicKey: 'AAECAw', subscribed: false, devices: 0, budget: 3, calm: false, watch: [], unread: 0, log: [] }
const BASE: Fixtures = {
  '/me/notifications': { notices: [], prefs: DEFAULT_PREFS },
  '/me/push': STATUS,
  '/me/calendar-feed': { on: false, path: null },
}

async function open(over: Fixtures = {}, path = '/me/notifications') {
  const net = stubNetwork({ ...over, ...SERVER, ...BASE, ...over })
  await signInAs()
  await renderAt(path)
  return net
}
const main = () => screen.getByRole('main')

/** A browser that can do push, with a spy for the permission prompt. */
function browserWithPush(permission: NotificationPermission = 'default') {
  const requestPermission = vi.fn(async () => 'granted' as NotificationPermission)
  vi.stubGlobal('Notification', Object.assign(function Notification() {}, { permission, requestPermission }))
  Object.defineProperty(window, 'PushManager', { value: function PushManager() {}, configurable: true })
  const sub = { endpoint: 'https://push.example/abc', getKey: (n: string) => new Uint8Array([n === 'auth' ? 9 : 4, 1, 2]).buffer, unsubscribe: vi.fn(async () => true) }
  let held: typeof sub | null = null
  const pushManager = { getSubscription: async () => held, subscribe: vi.fn(async () => (held = sub)) }
  Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: async () => ({ pushManager }), ready: Promise.resolve({ pushManager }), addEventListener: () => undefined, removeEventListener: () => undefined }, configurable: true })
  return { requestPermission, pushManager }
}

describe('turning on alerts (N3.1)', () => {
  it('does not ask for permission just by opening the screen; it asks in plain words and only when tapped', async () => {
    const { requestPermission, pushManager } = browserWithPush()
    const net = await open()
    await within(main()).findByText('Get alerts on this phone?')
    expect(requestPermission).not.toHaveBeenCalled()
    fireEvent.click(within(main()).getByRole('button', { name: 'Turn on alerts' }))
    await waitFor(() => expect(requestPermission).toHaveBeenCalledOnce())
    await waitFor(() => expect(pushManager.subscribe).toHaveBeenCalledOnce())
    await waitFor(() => expect(net.calls).toContain('PUT /me/push/subscription'))
  })

  it('on the port day, asks the in-context question', async () => {
    browserWithPush()
    await open({}, '/ship/port')
    await within(main()).findByText('Allow all-aboard warnings?')
  })

  it('on an iPhone that has not added the app to the Home Screen, says to do that first', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604')
    await open()
    await within(main()).findByText('Add this app to your Home Screen first')
    expect(within(main()).queryByRole('button', { name: 'Turn on alerts' })).toBeNull()
  })

  it('says plainly that alerts are blocked in the browser, and who can change it', async () => {
    browserWithPush('denied')
    await open()
    await within(main()).findByText('Alerts are blocked in your browser')
    expect(within(main()).getByText(/Only you can change this/)).toBeTruthy()
  })

  it('says so when this browser cannot show alerts at all', async () => {
    await open()
    await within(main()).findByText('This browser cannot show alerts')
  })

  it('says so when the server cannot send yet, without saying why', async () => {
    browserWithPush()
    await open({ '/me/push': { ...STATUS, available: false, publicKey: null } })
    await within(main()).findByText('Alerts are not switched on for this app yet')
    expect(within(main()).queryByRole('button', { name: 'Turn on alerts' })).toBeNull()
  })
})

describe('what we sent you (N3.6)', () => {
  const log = [
    { key: 'allAboard:d:30', kind: 'allAboard', outcome: 'sent', reason: null, critical: true, devices: 1, params: {}, at: Date.UTC(2027, 2, 24, 19, 0), read: false },
    { key: 'payment:dueSoon:x', kind: 'payment', outcome: 'held', reason: 'quiet', critical: false, devices: 0, params: {}, at: Date.UTC(2027, 2, 24, 3, 0), read: false },
  ]

  it('shows each alert, and for a held one the reason, and for a safety one why it ignored the limits', async () => {
    await open({ '/me/push': { ...STATUS, unread: 1, log } })
    await within(main()).findByText('What we sent you')
    expect(await within(main()).findByText('All aboard reminder')).toBeTruthy()
    expect(within(main()).getByText(/A safety alert, so it ignores quiet hours/)).toBeTruthy()
    expect(within(main()).getByText(/It arrived during your quiet hours/)).toBeTruthy()
  })

  it('counts the alerts as seen when the log is opened', async () => {
    const net = await open({ '/me/push': { ...STATUS, unread: 1, log }, 'POST /me/push/read': { ...STATUS, unread: 0, log } })
    await waitFor(() => expect(net.calls).toContain('POST /me/push/read'))
  })

  it('says when there is nothing yet', async () => {
    await open()
    await within(main()).findByText('Nothing yet.')
  })
})

describe('the calendar link (N3.4)', () => {
  it('shows the address once when made, and then only says there is one', async () => {
    await open({ 'POST /me/calendar-feed': { on: true, path: '/calendar/tok123.ics' } })
    fireEvent.click(await within(main()).findByRole('button', { name: 'Make my calendar link' }))
    const box = (await within(main()).findByLabelText('Your calendar link')) as HTMLInputElement
    expect(box.value).toMatch(/\/calendar\/tok123\.ics$/)
    expect(within(main()).getByText(/cannot be shown again/)).toBeTruthy()
  })

  it('offers to replace or turn off a link that exists, never to show it', async () => {
    await open({ '/me/calendar-feed': { on: true, path: null } })
    await within(main()).findByText('You have a calendar link. It is not shown again.')
    expect(within(main()).getByRole('button', { name: 'Make a new link' })).toBeTruthy()
    expect(within(main()).getByRole('button', { name: 'Turn the link off' })).toBeTruthy()
    expect(within(main()).queryByLabelText('Your calendar link')).toBeNull()
  })
})
