// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderAt, signInAs, stubNetwork, teardown } from '../testing/harness'
import { BOOKING, SERVER } from '../testing/fixtures'

// proves: TRU-05#1
/** TRU-05: a failed reschedule leaves the original reservation in place and says so in plain words. Real client and screen; only `fetch` is stubbed. */
afterEach(teardown)
const main = () => screen.getByRole('main')
const problem = (status: number, title: string) => new Response(JSON.stringify({ title }), { status, headers: { 'content-type': 'application/json' } })

async function tryMove(answer: Response) {
  const net = stubNetwork({
    ...SERVER,
    [`/bookings/${BOOKING}/dining/slots`]: [{ time: '20:30', tables: 3 }],
    [`POST /bookings/${BOOKING}/dining/reservations/r1/move`]: () => answer,
  })
  await signInAs()
  await renderAt('/plan/reservations/r1')
  await waitFor(() => expect(within(main()).getByLabelText(/8:30/)).toBeTruthy())
  fireEvent.click(within(main()).getByLabelText(/8:30/))
  fireEvent.click(within(main()).getByRole('button', { name: /move my reservation/i }))
  return net
}

describe('TRU-05: a failed reschedule keeps the original', () => {
  it('says the table was taken, says nothing changed, and still shows the original time', async () => {
    const net = await tryMove(problem(409, 'full'))
    await waitFor(() => expect(within(main()).getByRole('alert').textContent).toMatch(/just taken/))
    expect(within(main()).getByText(/Nothing was changed\. Your table is still/).textContent).toMatch(/7:00/)
    expect(within(main()).queryByText(/^Moved to night/)).toBeNull()
    expect(net.calls.filter((c) => c.endsWith('/move'))).toHaveLength(1)
    expect(net.calls.some((c) => c.startsWith('DELETE'))).toBe(false)
  })

  it('on a server failure, gives a plain retry message with no code or stack, and keeps the original', async () => {
    await tryMove(problem(500, 'server'))
    await waitFor(() => expect(within(main()).getByRole('alert').textContent).toMatch(/nothing was changed/i))
    expect(within(main()).getByRole('alert').textContent).not.toMatch(/500|server|exception|undefined/i)
    expect(within(main()).getByText(/Your table is still/)).toBeTruthy()
  })
})
