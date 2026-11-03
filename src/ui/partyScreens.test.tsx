// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderAt, signInAs, stubNetwork, teardown, type Fixtures } from '../testing/harness'
import { SERVER } from '../testing/fixtures'
import { getSharing } from '../sharing/store'

/**
 * N4 on the screens: the organiser sees only what each person shares and the money only as the booker, the poll and board are one vote each from this phone,
 * a share link is shown once and can be ended, and the page behind a link is read-only and says when it has ended. The server is a stand-in.
 */
afterEach(() => { teardown(); localStorage.clear() })

const TOKEN = 'A'.repeat(43)
const ORGANISER = {
  number: 'ABC123', ship: 'Sun Princess', departureMs: Date.UTC(2027, 2, 1), daysToGo: 12, youAreBooker: true,
  guests: [
    { id: 'g1', name: 'Tess Tester', child: false, isYou: true, sharesStatus: true, checkin: { done: 6, total: 6 }, documents: 2 },
    { id: 'g2', name: 'Sam Tester', child: false, isYou: false, sharesStatus: false, checkin: null, documents: null },
    { id: 'g3', name: 'Ola Tester', child: false, isYou: false, sharesStatus: true, checkin: { done: 2, total: 6 }, documents: 1 },
  ],
  money: { paidCents: 50_000, totalCents: 120_000, paidInFull: false, finalDueMs: Date.UTC(2027, 0, 1) },
}
const BASE: Fixtures = {
  '/bookings/B1/organiser': ORGANISER,
  '/bookings/B1/party-log': [{ kind: 'poll', label: 'Where to eat?', at: 1_700_000_000_000, deleted: false }, { kind: 'idea', label: 'Swim with rays', at: 1_699_000_000_000, deleted: true }],
  'GET /bookings/B1/share-links': [],
}

async function open(path: string, over: Fixtures = {}) {
  const net = stubNetwork({ ...SERVER, ...BASE, ...over })
  await signInAs()
  await renderAt(path)
  return net
}
const main = () => screen.getByRole('main')

describe('organiser (N4.5)', () => {
  it('shows each person only as far as they chose to share, and the money to the booker', async () => {
    await open('/plan/organiser')
    const m = within(main())
    await m.findByText('Sun Princess, 12 days to go')
    expect(m.getByText(/Tess Tester/).closest('li')?.textContent).toMatch(/check-in finished/)
    expect(m.getByText(/Sam Tester/).closest('li')?.textContent).toMatch(/has not shared their progress/)
    expect(m.getByText(/Ola Tester/).closest('li')?.textContent).toMatch(/2 of 6 check-in steps done/)
    expect(m.getByText(/Still owed/)).toBeTruthy()
  })

  it('tells someone who is not the booker that the money is the booker’s alone', async () => {
    await open('/plan/organiser', { '/bookings/B1/organiser': { ...ORGANISER, youAreBooker: false, money: null } })
    await within(main()).findByText('Only the person who made the booking sees the money.')
  })

  it('lists the recent changes to the shared plan, with removals said as removals', async () => {
    await open('/plan/organiser')
    await within(main()).findByText(/Changed: poll Where to eat\?/)
    expect(within(main()).getByText(/Removed: idea Swim with rays/)).toBeTruthy()
  })

  it('starts with nothing shared, and a tick is kept for the account', async () => {
    const net = await open('/plan/organiser', { 'PUT /me/state/sharing': { key: 'sharing', version: 1, data: {} } })
    const box = await within(main()).findByLabelText('My check-in progress and documents')
    expect((box as HTMLInputElement).checked).toBe(false)
    fireEvent.click(box)
    expect(getSharing('u1')).toEqual({ plans: false, status: true, spending: false, photos: false })
    await waitFor(() => expect((within(main()).getByLabelText('My check-in progress and documents') as HTMLInputElement).checked).toBe(true))
    expect(within(main()).getByText(/never shared/)).toBeTruthy()
    expect(net.calls).toContain('GET /bookings/B1/organiser')
  })
})

describe('group poll (N4.2)', () => {
  it('makes a poll, counts this phone’s vote once, and changes it when voting again', async () => {
    await open('/plan/group-poll')
    const m = within(main())
    fireEvent.change(await m.findByLabelText('Question'), { target: { value: 'Where to eat?' } })
    fireEvent.change(m.getByLabelText(/Choices/), { target: { value: 'Pizza, Tacos' } })
    fireEvent.click(m.getByRole('button', { name: 'Create Poll' }))
    await m.findByText('You have not voted yet.', { exact: false })
    fireEvent.click(m.getByRole('button', { name: 'Pizza' }))
    await m.findByText(/You chose Pizza/)
    expect(m.getAllByText('1 vote').length).toBe(1)
    fireEvent.click(m.getByRole('button', { name: 'Tacos' }))
    await m.findByText(/You chose Tacos/)
    expect(m.getAllByText('1 vote').length).toBe(1)
  })

  it('says that everyone on the booking sees it', async () => {
    await open('/plan/group-poll')
    await within(main()).findByText(/Everyone on your booking sees these polls and ideas/)
  })
})

describe('share links (N4.6)', () => {
  it('says what the people with a link see and never see before anything is made', async () => {
    await open('/plan/share-links')
    const m = within(main())
    await m.findByText('What They Never See')
    expect(m.getByText(/Where you are, your medical card/)).toBeTruthy()
  })

  it('shows the address once, when it is made, and lists the link without it', async () => {
    let made = false
    const link = { id: 'l1', kind: 'caregiver', label: 'Mum', createdAt: 1, expiresAt: Date.now() + 90 * 86_400_000, lastCheckInAt: null, note: '' }
    await open('/plan/share-links', {
      'GET /bookings/B1/share-links': () => (made ? [link] : []),
      'POST /bookings/B1/share-links': () => { made = true; return { ...link, path: `/shared/${TOKEN}` } },
    })
    const m = within(main())
    fireEvent.change(await m.findByLabelText(/A name for it/), { target: { value: 'Mum' } })
    fireEvent.click(m.getByRole('button', { name: 'Make the Link' }))
    const field = await m.findByLabelText('The link address')
    expect((field as HTMLInputElement).value).toContain(`/shared/${TOKEN}`)
    await m.findByText('Mum')
    expect(m.getByText('Your Links')).toBeTruthy()
  })

  it('ends a link on request', async () => {
    const link = { id: 'l1', kind: 'caregiver', label: 'Mum', createdAt: 1, expiresAt: Date.now() + 90 * 86_400_000, lastCheckInAt: null, note: '' }
    const net = await open('/plan/share-links', { 'GET /bookings/B1/share-links': [link], 'DELETE /bookings/B1/share-links/l1': undefined })
    fireEvent.click(await within(main()).findByRole('button', { name: 'End This Link Now' }))
    await waitFor(() => expect(net.calls.some((c) => c.startsWith('DELETE ') && c.includes('/share-links/l1'))).toBe(true))
  })

  it('tells a booker-only refusal in words', async () => {
    await open('/plan/share-links', {
      'POST /bookings/B1/share-links': () => new Response(JSON.stringify({ title: 'bookerOnly' }), { status: 403, headers: { 'content-type': 'application/json' } }),
    })
    const m = within(main())
    fireEvent.click(await m.findByLabelText('My travel advisor'))
    fireEvent.change(m.getByLabelText(/A name for it/), { target: { value: 'Pat' } })
    fireEvent.click(m.getByRole('button', { name: 'Make the Link' }))
    await m.findByText(/Only the person who made the booking can make a link for an advisor/)
  })
})

describe('the page behind a link (N4.6)', () => {
  it('shows a caregiver the sailing and the “I am fine” note, never a position', async () => {
    stubNetwork({ ...SERVER, [`/public/share/${TOKEN}`]: { kind: 'caregiver', label: 'Mum', guestFirstName: 'Tess', ship: 'Sun Princess', departureMs: Date.UTC(2027, 2, 1), nights: 7, daysToGo: 12, lastCheckInAt: Date.UTC(2027, 1, 20), note: 'All good, lovely day', checkinDone: true, paidInFull: null, progress: null, guests: null } })
    await renderAt(`/shared/${TOKEN}`)
    const m = within(main())
    await m.findByText('Sun Princess')
    expect(m.getByText(/12 days to go/)).toBeTruthy()
    expect(m.getByText(/All good, lovely day/)).toBeTruthy()
    expect(m.getByText('This page never shows where anyone is.')).toBeTruthy()
    expect(m.queryByRole('button')).toBeNull()
  })

  it('shows an advisor the progress, not the amounts', async () => {
    stubNetwork({ ...SERVER, [`/public/share/${TOKEN}`]: { kind: 'advisor', label: 'Pat', guestFirstName: 'Tess', ship: 'Sun Princess', departureMs: Date.UTC(2027, 2, 1), nights: 7, daysToGo: 12, lastCheckInAt: null, note: '', checkinDone: null, paidInFull: false, progress: { done: 8, total: 12 }, guests: 2 } })
    await renderAt(`/shared/${TOKEN}`)
    const m = within(main())
    await m.findByText('There is still a balance to pay.')
    expect(m.getByText(/8 of 12 check-in steps/)).toBeTruthy()
    expect(main().textContent).not.toMatch(/\$/)
  })

  it('says plainly when the link has ended', async () => {
    stubNetwork({ ...SERVER, [`/public/share/${TOKEN}`]: () => new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } }) })
    await renderAt(`/shared/${TOKEN}`)
    await within(main()).findByText('This link has ended or is not right')
  })

  it('does not ask the server about an address that cannot be a link', async () => {
    const net = stubNetwork({ ...SERVER })
    await renderAt('/shared/short')
    await within(main()).findByText('This link has ended or is not right')
    expect(net.calls.some((c) => c.includes('/public/share/'))).toBe(false)
  })
})
