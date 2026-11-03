// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderAt, signInAs, stubNetwork, teardown } from '../testing/harness'
import { SERVER } from '../testing/fixtures'
import { recordJourney } from '../runtime'

/** The front end tells the server what moves a guest's stage (`POST /me/journey/events`), once, and never fails the screen. */
afterEach(teardown)

const POST = 'POST /me/journey/events'

describe('journey events', () => {
  it('sends an event once per kind and sailing, and nothing without a sailing', async () => {
    const net = stubNetwork({ ...SERVER, [POST]: undefined })
    await signInAs()
    await recordJourney('cabinView', null)
    await recordJourney('cabinView', 'sun-2027-03-21')
    await recordJourney('cabinView', 'sun-2027-03-21')
    await recordJourney('lookCloser', 'sun-2027-03-21')
    expect(net.calls.filter((c) => c === POST)).toHaveLength(2)
  })

  it('does not throw when the server refuses, and tries again next time', async () => {
    const net = stubNetwork({ ...SERVER, [POST]: () => new Response('{}', { status: 403, headers: { 'content-type': 'application/json' } }) })
    await signInAs()
    await expect(recordJourney('planImported', 'sun-2027-03-21')).resolves.toBeUndefined()
    await recordJourney('planImported', 'sun-2027-03-21')
    expect(net.calls.filter((c) => c === POST)).toHaveLength(2)
  })

  it('tells the server a guest is at the terminal, from the terminal screen', async () => {
    const net = stubNetwork({ ...SERVER, [POST]: undefined })
    await signInAs()
    await renderAt('/home/check-in/terminal')
    const main = screen.getByRole('main')
    fireEvent.click(await within(main).findByRole('button', { name: /at the terminal/i }))
    await waitFor(() => expect(net.calls).toContain(POST))
  })
})
