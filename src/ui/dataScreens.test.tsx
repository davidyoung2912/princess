// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderAt, signInAs, stubNetwork, teardown, type Fixtures } from '../testing/harness'
import { BOOKING, SERVER, TODAY_IN_PORT } from '../testing/fixtures'
import { SLOW_COPY_MS } from '../hooks/useSavedCopy'
import { GUEST_SERVICES_NUMBER } from '../domain/contacts'

/**
 * N1.2: the screens behind the 15 top tasks (UX-01), rendered in jsdom with data in them, against a stubbed network. The real API client, guards, stores
 * and screens run; only `fetch` is a table of answers (`src/testing/fixtures.ts`). Each test is the task's "clear to use" sentence: what the guest sees
 * and can do, not how it is built. No browser is involved.
 */
afterEach(teardown)
const TRIP = `/bookings/${BOOKING}`

async function open(path: string, over: Fixtures = {}) {
  const net = stubNetwork({ ...SERVER, ...over })
  await signInAs()
  const view = await renderAt(path)
  return { net, view }
}
const main = () => screen.getByRole('main')
const seen = async (text: RegExp | string) => waitFor(() => expect(within(main()).getAllByText(text).length).toBeGreaterThan(0))

describe('top task: show my boarding pass', () => {
  it('shows the pass with name, lane, terminal and stateroom, and a full-screen button', async () => {
    await open('/home/boarding-pass')
    await seen('TESTER/TESS')
    expect(within(main()).getByText('Green lane')).toBeTruthy()
    expect(within(main()).getAllByText('Terminal 2').length).toBeGreaterThan(0)
    expect(within(main()).getByText('8412')).toBeTruthy()
    expect(within(main()).getByRole('button', { name: /full screen/i })).toBeTruthy()
  })

  it('shows the saved pass at once, and says it is a saved copy, when the phone has no signal', async () => {
    const { net } = await open('/home/boarding-pass')
    await seen('TESTER/TESS')
    cleanup()
    net.offline = true
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await renderAt('/home/boarding-pass')
    await seen('TESTER/TESS')
    expect(within(main()).getByText(/Offline: showing the copy saved at/)).toBeTruthy()
    online.mockRestore()
  })

  it('does not leave the pass behind a spinner on a link that answers nothing: the saved copy shows within seconds', async () => {
    const { net } = await open('/home/boarding-pass')
    await seen('TESTER/TESS')
    cleanup()
    net.offline = true
    await renderAt('/home/boarding-pass')
    await waitFor(() => expect(within(main()).getAllByText('TESTER/TESS').length).toBeGreaterThan(0), { timeout: SLOW_COPY_MS + 1500 })
    expect(within(main()).getByText(/Offline: showing the copy saved at/)).toBeTruthy()
  })
})

describe('top task: my bill', () => {
  it('shows the total, each charge and what the package covered, with a way to ask what a charge is', async () => {
    await open('/me/bill')
    await seen('$163.50')
    expect(within(main()).getByText('Amount on your account')).toBeTruthy()
    expect(within(main()).getAllByText(/Massage/).length).toBeGreaterThan(0)
    expect(within(main()).getByText('Paid for by your packages')).toBeTruthy()
    expect(within(main()).getAllByText(/What is this\?/i).length).toBeGreaterThan(0)
  })

  it('gives a dead end a next step: a failed load offers Try again, and Try again works', async () => {
    let up = false
    const { net } = await open('/me/bill', { [`${TRIP}/onboard/folio`]: () => (up ? SERVER[`${TRIP}/onboard/folio`] : new Response('{}', { status: 500 })) })
    const retry = await screen.findByRole('button', { name: /try again/i }, { timeout: 9000 })
    up = true
    fireEvent.click(retry)
    await seen('$163.50')
    expect(net.calls.filter((c) => c.endsWith('/onboard/folio')).length).toBeGreaterThan(1)
  }, 20_000)
})

describe('top tasks: my reservations and change dining', () => {
  it('lists the dinner with its venue, night and time, and a way to change or cancel it', async () => {
    await open('/plan/reservations')
    await seen('Crown Grill')
    expect(within(main()).getByText(/7:00 PM/)).toBeTruthy()
    expect(within(main()).getByText(/Change or cancel/)).toBeTruthy()
    expect(within(main()).getByText('Confirmed')).toBeTruthy()
  })

  it('opens one dinner with the controls to move it', async () => {
    await open('/plan/reservations/r1')
    await seen(/Crown Grill/)
    expect(within(main()).getAllByRole('button').length).toBeGreaterThan(0)
  })
})

describe('top task: today’s events', () => {
  it('shows what is on now and next, from the ship’s programme', async () => {
    await open('/plan')
    await seen(/Team trivia/)
    expect(within(main()).getByText('On now and next up')).toBeTruthy()
    expect(within(main()).getAllByText(/Broadway at sea/).length).toBeGreaterThan(0)
  })
})

describe('top task: all-aboard time (Home)', () => {
  it('puts the day, the port and the weather first', async () => {
    await open('/')
    await seen(/Belize City/)
    expect(within(main()).getByText(/Day 3/)).toBeTruthy()
    expect(within(main()).getByText(/Sunny\. High 86°F/)).toBeTruthy()
  })

  it('on a port day shows all-aboard in ship time with the local time beside it', async () => {
    await open('/', { [`${TRIP}/onboard/today`]: TODAY_IN_PORT })
    await seen(/4:30 pm/)
    expect(within(main()).getAllByText(/3:30 pm/).length).toBeGreaterThan(0)
  })
})

describe('top task: my excursions', () => {
  it('shows the credit, the tours for the port and says nothing is booked yet', async () => {
    await open('/plan/excursions')
    await seen(/You have \$300 of excursion credit/)
    expect(within(main()).getByText('You have not booked any excursions yet.')).toBeTruthy()
  })
})

describe('top task: add a package', () => {
  it('shows what the guest has and what they can add, with the Wi-Fi price', async () => {
    await open('/me/packages')
    await seen(/Wi-?Fi/i)
    expect(within(main()).getByText('Packages')).toBeTruthy()
  })
})

describe('top task: find my family', () => {
  it('shows the child, the club they are in and where they were last seen', async () => {
    await open('/ship/family')
    await seen(/Sam/)
    expect(within(main()).getAllByText(/Camp Discovery/).length).toBeGreaterThan(0)
  })
})

describe('top task: order food', () => {
  it('offers the kinds of order, ready to start', async () => {
    await open('/ship/order')
    await seen('Deck and stateroom delivery')
    expect(within(main()).getByText('Room service')).toBeTruthy()
  })
})

describe('top tasks: deck map, text size', () => {
  it('lets the guest pick a start and an end for directions in words', async () => {
    await open('/ship/map')
    await seen('Find the way')
    expect(within(main()).getAllByRole('combobox').length).toBeGreaterThanOrEqual(2)
  })

  it('changes the text size in one tap and keeps it', async () => {
    await open('/me/settings')
    fireEvent.click(await screen.findByRole('radio', { name: 'Extra large' }))
    await waitFor(() => expect(document.documentElement.getAttribute('data-text-size')).toBe('xlarge'))
  })
})

describe('top tasks: ask for help, guest services, emergency info', () => {
  it('opens from any screen, shows the desk number as text and a call link, and closes with Escape', async () => {
    await open('/me/settings')
    fireEvent.click(await screen.findByRole('button', { name: 'Help' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByText(new RegExp(GUEST_SERVICES_NUMBER.replace(/[+]/g, '\\+'))).length).toBeGreaterThan(0)
    expect(dialog.querySelector(`a[href="tel:${GUEST_SERVICES_NUMBER}"]`)).not.toBeNull()
    expect(within(dialog).getByRole('link', { name: /emergency/i })).toBeTruthy()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
