import { describe, expect, it } from 'vitest'
import { recapProblem, RECAP_MAX_CHARS, RECAP_MAX_LINE, RECAP_MAX_LINES, addContact, addPostcard, adoptServerLink, liveLinkIds, normalizePublicFamily, normalizeServerLink, daysLeft, EMPTY_HOME, familyView, flushPostcards, isLive, issueLink, linkToken, liveLinkFor, MAX_CONTACTS, MAX_POSTCARDS, normalizeHome, queuedPostcards, removeContact, revokeAll, revokeLink, tokenOwner, verifyLink, type HomeState } from './homeLink'

const DAY = 86_400_000
const withPerson = (): HomeState => addContact(EMPTY_HOME, 'Ann', 'ann@example.com', 'c1').state
const withLink = (now = 1000, days = 7) => {
  const r = issueLink(withPerson(), 'c1', now, 'l1', 'sekret1', days)
  return { state: r.state, link: r.link! }
}

describe('contacts', () => {
  it('needs a name and a valid, new email, up to five people', () => {
    expect(addContact(EMPTY_HOME, ' ', 'a@b.co', 'x').problem).toBe('name')
    expect(addContact(EMPTY_HOME, 'A', 'nope', 'x').problem).toBe('email')
    expect(addContact(withPerson(), 'Ann again', 'ANN@example.com', 'c2').problem).toBe('duplicate')
    let s = EMPTY_HOME
    for (let i = 0; i < MAX_CONTACTS; i++) s = addContact(s, `P${i}`, `p${i}@x.co`, `c${i}`).state
    expect(addContact(s, 'Extra', 'extra@x.co', 'cx').problem).toBe('tooMany')
  })
  it('stops a person’s links when they are removed', () => {
    const { state, link } = withLink()
    const after = removeContact(state, 'c1')
    expect(after.contacts).toEqual([])
    expect(verifyLink(linkToken(state, 'gerald', link), 'gerald', after, 2000)).toMatchObject({ ok: false })
  })
})

describe('signed links', () => {
  it('opens for the right person, owner and moment', () => {
    const { state, link } = withLink()
    const token = linkToken(state, 'gerald', link)
    expect(tokenOwner(token)).toBe('gerald')
    const ok = verifyLink(token, 'gerald', state, 2000)
    expect(ok.ok && ok.contact.name).toBe('Ann')
  })
  it('refuses a changed link, a different owner and rubbish', () => {
    const { state, link } = withLink()
    const token = linkToken(state, 'gerald', link)
    const parts = token.split('.')
    const longer = [...parts.slice(0, 2), (parseInt(parts[2], 36) + DAY).toString(36), parts[3]].join('.')
    expect(verifyLink(longer, 'gerald', state, 2000)).toEqual({ ok: false, reason: 'signature' })
    expect(verifyLink(`${token}x`, 'gerald', state, 2000)).toEqual({ ok: false, reason: 'signature' })
    expect(verifyLink(token, 'maria', state, 2000)).toEqual({ ok: false, reason: 'malformed' })
    expect(verifyLink('a.b', 'a', state, 1)).toEqual({ ok: false, reason: 'malformed' })
    expect(verifyLink('', 'a', state, 1)).toEqual({ ok: false, reason: 'malformed' })
    expect(verifyLink(token, 'gerald', { ...state, secret: 'other' }, 2000)).toEqual({ ok: false, reason: 'signature' })
    expect(tokenOwner('..')).toBeNull()
    expect(tokenOwner('<script>.a.b.c')).toBeNull()
  })
  it('expires exactly at the end and says so', () => {
    const { state, link } = withLink(1000, 3)
    const token = linkToken(state, 'gerald', link)
    expect(verifyLink(token, 'gerald', state, 1000 + 3 * DAY - 1).ok).toBe(true)
    expect(verifyLink(token, 'gerald', state, 1000 + 3 * DAY)).toEqual({ ok: false, reason: 'expired' })
    expect(daysLeft(link, 1000)).toBe(3)
    expect(daysLeft(link, 1000 + 5 * DAY)).toBe(0)
  })
  it('can be revoked at any time, one or all', () => {
    const { state, link } = withLink()
    const token = linkToken(state, 'gerald', link)
    expect(verifyLink(token, 'gerald', revokeLink(state, 'l1'), 2000)).toEqual({ ok: false, reason: 'revoked' })
    expect(verifyLink(token, 'gerald', revokeAll(state), 2000)).toEqual({ ok: false, reason: 'revoked' })
    expect(isLive(revokeLink(state, 'l1').links[0], 2000)).toBe(false)
  })
  it('keeps one live link per person: a new one replaces the old', () => {
    const { state, link } = withLink()
    const second = issueLink(state, 'c1', 3000, 'l2', 'ignored', 14)
    expect(verifyLink(linkToken(second.state, 'gerald', link), 'gerald', second.state, 4000)).toEqual({ ok: false, reason: 'revoked' })
    expect(second.state.secret).toBe('sekret1')
    expect(liveLinkFor(second.state, 'c1', 4000)?.id).toBe('l2')
    expect(daysLeft(second.link!, 3000)).toBe(14)
  })
  it('only links a known person, with a safe id, for an allowed length', () => {
    expect(issueLink(withPerson(), 'nobody', 1, 'l', 's').link).toBeNull()
    expect(issueLink(withPerson(), 'c1', 1, 'bad.id', 's').link).toBeNull()
    expect(daysLeft(issueLink(withPerson(), 'c1', 1, 'l', 's', 999).link!, 1)).toBe(7)
  })
})

describe('postcards', () => {
  it('queue offline and send when there is signal (S6-24)', () => {
    let s = addPostcard(EMPTY_HOME, 'ok', ' hi ', 1, 'p1', false)
    expect(queuedPostcards(s)).toBe(1)
    s = addPostcard(s, 'sea', '', 2, 'p2', true)
    expect(queuedPostcards(s)).toBe(1)
    s = flushPostcards(s, 9)
    expect(queuedPostcards(s)).toBe(0)
    expect(s.postcards[0]).toMatchObject({ sent: true, sentAt: 9, note: 'hi' })
    expect(flushPostcards(s, 10)).toBe(s)
  })
  it('keeps the newest and limits the note', () => {
    let s = EMPTY_HOME
    for (let i = 0; i < MAX_POSTCARDS + 5; i++) s = addPostcard(s, 'ok', 'x'.repeat(300), i, `p${i}`, true)
    expect(s.postcards).toHaveLength(MAX_POSTCARDS)
    expect(s.postcards[0].note).toHaveLength(140)
    expect(s.postcards[MAX_POSTCARDS - 1].id).toBe(`p${MAX_POSTCARDS + 4}`)
  })
})

describe('what the family sees', () => {
  const ctx = { guestFirst: 'Gerald', shipName: 'Sun Princess', itinerary: [{ day: 1, date: '2027-03-21', place: 'Fort Lauderdale' }], shipAt: null, notices: [], delayedMinutes: null, now: 1 } as const
  it('is a fixed list of ship-level fields, with no location, cabin or money', () => {
    const { state, link } = withLink()
    const view = familyView(addPostcard(state, 'ok', '', 1, 'p', true), link, ctx)
    expect(Object.keys(view).sort()).toEqual(['delayedMinutes', 'expiresAt', 'guestFirst', 'itinerary', 'notices', 'postcards', 'recap', 'shipAt', 'shipName'])
    expect(Object.keys(view.postcards[0]).sort()).toEqual(['at', 'id', 'kind', 'note'])
    const text = JSON.stringify(view).toLowerCase()
    for (const word of ['cabin', 'location', 'email', 'secret', 'bill', 'deck']) expect(text.includes(word), word).toBe(false)
  })
  it('leaves out postcards still waiting to be sent', () => {
    const { state, link } = withLink()
    expect(familyView(addPostcard(state, 'ok', '', 1, 'p', false), link, ctx).postcards).toEqual([])
  })
})

describe('saved state', () => {
  it('round-trips and drops anything bad', () => {
    const { state } = withLink()
    const saved = addPostcard(state, 'love', 'hi', 1, 'p', false)
    expect(normalizeHome(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
    expect(normalizeHome(null)).toEqual(EMPTY_HOME)
    const bad = normalizeHome({ secret: 'a.b', contacts: [{ id: 'a b', name: 'x', email: 'a@b.co' }, { id: 'ok', name: '', email: 'a@b.co' }, { id: 'e', name: 'E', email: 'nope' }], links: [{ id: 'l' }], postcards: [{ id: 'p', kind: 'bogus', at: 1 }] })
    expect(bad).toEqual(EMPTY_HOME)
  })
})

describe('links signed by the server', () => {
  const state = addContact(EMPTY_HOME, 'Ann', 'ann@example.com', 'c1').state
  it('reads the answer and refuses a malformed one', () => {
    expect(normalizeServerLink({ id: 'abc123', token: 'a.b.c.d', expiresAt: 5 })).toEqual({ id: 'abc123', token: 'a.b.c.d', expiresAt: 5 })
    expect(normalizeServerLink({ id: 'bad id!', token: 'x', expiresAt: 5 })).toBeNull()
    expect(normalizeServerLink({ id: 'a', token: '', expiresAt: 5 })).toBeNull()
    expect(normalizeServerLink(null)).toBeNull()
  })
  it('keeps one live link per person and says which one it replaced', () => {
    const first = adoptServerLink(state, 'c1', { id: 'l1', token: 't', expiresAt: 10_000 }, 1000)
    expect(first.replaced).toEqual([])
    const second = adoptServerLink(first.state, 'c1', { id: 'l2', token: 't', expiresAt: 20_000 }, 2000)
    expect(second.replaced).toEqual(['l1'])
    expect(liveLinkIds(second.state, 3000)).toEqual(['l2'])
    expect(liveLinkIds(second.state, 3000, 'nobody')).toEqual([])
    expect(adoptServerLink(state, 'ghost', { id: 'l3', token: 't', expiresAt: 1 }, 0).state).toBe(state)
  })
  it('turns the public answer into a page or a reason', () => {
    const ok = normalizePublicFamily({ ok: true, guestFirst: 'Dan', expiresAt: 9, postcards: [{ kind: 'ok', note: 'Hi', at: 1 }, { kind: 'spam', note: '', at: 2 }], scenarios: ['a', 3] })
    expect(ok).toEqual({ ok: true, guestFirst: 'Dan', expiresAt: 9, postcards: [{ id: '0', kind: 'ok', note: 'Hi', at: 1 }], scenarios: ['a'], delayedMinutes: null, recap: null })
    expect(normalizePublicFamily({ ok: true, guestFirst: 'Dan', delayedMinutes: 90.4 })).toMatchObject({ delayedMinutes: 90 })
    expect(normalizePublicFamily({ ok: true, guestFirst: 'Dan', delayedMinutes: 'soon' })).toMatchObject({ delayedMinutes: null })
    // The recap the guest shared is read only if it is within the limits the server enforces, and is cleaned the same way.
    expect(normalizePublicFamily({ ok: true, guestFirst: 'Dan', recap: ' Day one \n\n Day two\u0007 ' })).toMatchObject({ recap: 'Day one\nDay two' })
    expect(normalizePublicFamily({ ok: true, guestFirst: 'Dan', recap: 'x'.repeat(RECAP_MAX_CHARS + 1) })).toMatchObject({ recap: null })
    expect(normalizePublicFamily({ ok: true, guestFirst: 'Dan', recap: 7 })).toMatchObject({ recap: null })
    expect(normalizePublicFamily({ ok: false, reason: 'revoked' })).toEqual({ ok: false, reason: 'revoked' })
    expect(normalizePublicFamily({ ok: false, reason: 'whatever' })).toEqual({ ok: false, reason: 'malformed' })
    expect(normalizePublicFamily('x')).toEqual({ ok: false, reason: 'malformed' })
  })

  it('checks a recap against the same limits as the server and never cuts it', () => {
    expect(recapProblem('')).toBe('empty')
    expect(recapProblem(' \n ')).toBe('empty')
    expect(recapProblem('Seven nights in the sun.')).toBeNull()
    expect(recapProblem('x'.repeat(RECAP_MAX_LINE + 1))).toBe('longLine')
    expect(recapProblem(Array.from({ length: RECAP_MAX_LINES + 1 }, () => 'line').join('\n'))).toBe('tooManyLines')
    expect(recapProblem(Array.from({ length: 6 }, () => 'x'.repeat(150)).join('\n'))).toBe('tooLong')
    expect(recapProblem(Array.from({ length: 12 }, () => 'x'.repeat(60)).join('\n'))).toBeNull()
  })
})
