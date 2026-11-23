import { describe, expect, it } from 'vitest'
import { BUNDLE_VERSION, bundleLink, bundleSummary, eventRef, isKnownBundle, isPlannable, matchConversations, parseBundle, planRefOf, sendToMany, shareInput, tourEventId } from './chatBundles'

const venue = { type: 'venue', v: 1, title: 'Crown Grill', subtitle: 'Steakhouse', path: '/dining-today/crown-grill', place: 'Deck 7' }

describe('parseBundle', () => {
  it('keeps the plain fields of a bundle', () => {
    expect(parseBundle({ ...venue, day: 2, time: '19:00', ref: 'venue:crown-grill', note: 'join us?' })).toEqual({ ...venue, day: 2, time: '19:00', ref: 'venue:crown-grill', note: 'join us?' })
  })
  it('is total: garbage is null and never throws', () => {
    for (const bad of [null, undefined, 3, 'x', [], {}, { type: 'venue' }, { title: 'x' }, { type: '', title: 'x' }, { type: 'venue', title: '   ' }]) expect(parseBundle(bad)).toBeNull()
  })
  it('drops what is not a plain field and bounds what is', () => {
    const b = parseBundle({ type: 'venue', title: 'x'.repeat(500), data: { deep: 1 }, day: -1, time: 5 })
    expect(b?.title).toHaveLength(200)
    expect(b).not.toHaveProperty('data')
    expect(b).not.toHaveProperty('day')
    expect(b).not.toHaveProperty('time')
    expect(b?.v).toBe(1)
  })
})

describe('isKnownBundle and bundleLink', () => {
  it('knows venue and menu at this version', () => {
    expect(isKnownBundle(venue)).toBe(true)
    expect(isKnownBundle({ type: 'menu', v: BUNDLE_VERSION })).toBe(true)
  })
  it('does not know a newer payload or another type, so an older app shows the fallback', () => {
    expect(isKnownBundle({ type: 'venue', v: BUNDLE_VERSION + 1 })).toBe(false)
    expect(isKnownBundle({ type: 'game.sudoku', v: 1 })).toBe(false)
    expect(bundleLink({ type: 'game.sudoku', v: 1, path: '/dining-today/crown-grill' })).toBeNull()
  })
  it('opens only the screens a shared item may open', () => {
    expect(bundleLink(venue)).toBe('/dining-today/crown-grill')
    expect(bundleLink({ ...venue, path: 'https://example.com/x' })).toBeNull()
    expect(bundleLink({ ...venue, path: '/settings' })).toBeNull()
    expect(bundleLink({ type: 'venue', v: 1 })).toBeNull()
  })
})

describe('bundleSummary', () => {
  it('reads title, subtitle, when and where', () => {
    expect(bundleSummary(parseBundle({ ...venue, day: 2, time: '19:00' })!, (t) => `at ${t}`)).toBe('Crown Grill · Steakhouse · day 2, at 19:00 · Deck 7')
  })
})

describe('shareInput', () => {
  it('sends a venue or menu as a bundle', () => {
    expect(shareInput('venue:crown-grill', 'card')).toEqual({ kind: 'bundle', shareRef: 'venue:crown-grill' })
    expect(shareInput('menu:crown-grill:dinner', 'card', 'hi')).toEqual({ kind: 'bundle', shareRef: 'menu:crown-grill:dinner', note: 'hi' })
  })
  it('leaves the old card kinds untouched', () => {
    expect(shareInput('excursion:abc', 'card')).toEqual({ kind: 'card', shareRef: 'excursion:abc' })
    expect(shareInput('dining:abc', 'card')).toEqual({ kind: 'card', shareRef: 'dining:abc' })
    expect(shareInput('evt1:3', 'plan')).toEqual({ kind: 'plan', shareRef: 'evt1:3' })
  })
})

describe('matchConversations', () => {
  const rows = [{ name: 'Álex R.' }, { name: 'Family' }]
  it('matches without case or accents and lists all for an empty search', () => {
    expect(matchConversations(rows, 'alex')).toEqual([rows[0]])
    expect(matchConversations(rows, '  ')).toEqual(rows)
    expect(matchConversations(rows, 'zzz')).toEqual([])
  })
})

describe('sendToMany', () => {
  it('sends to each chat and reports each, a failure not stopping the rest', async () => {
    const sent: string[] = []
    const out = await sendToMany([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }], async (c) => { if (c.id === 'b') throw new Error('no'); sent.push(c.id) })
    expect(sent).toEqual(['a', 'c'])
    expect(out.map((o) => o.ok)).toEqual([true, false, true])
  })

  it('B2: an event, excursion or dinner is plannable; a booked excursion card is still its own kind', () => {
    expect(isPlannable({ type: 'excursion', day: 3 })).toBe(true)
    expect(isPlannable({ type: 'dinner' })).toBe(false)
    expect(isPlannable({ type: 'venue', day: 3 })).toBe(false)
    expect(shareInput('excursion:abc', 'card')).toEqual({ kind: 'card', shareRef: 'excursion:abc' })
    expect(shareInput(eventRef('trivia:3'), 'card', 'hi')).toEqual({ kind: 'bundle', shareRef: 'event:trivia:3', note: 'hi' })
    expect(planRefOf('event:tour~x1:3')).toBe('tour~x1:3')
    expect(planRefOf('venue:x')).toBeNull()
    expect(tourEventId('x1')).toBe('tour~x1')
  })
})
