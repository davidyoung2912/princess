import { describe, expect, it } from 'vitest'
import { BUNDLE_TYPES, BUNDLE_VERSION, REF_TYPES, bundleLink, bundleSummary, eventRef, forwardInput, gameOfBundle, isKnownBundle, isPlannable, matchConversations, parseBundle, planRefOf, sendToMany, shareInput, tourEventId } from './chatBundles'

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
    expect(isKnownBundle({ type: 'game.chess', v: 1 })).toBe(false)
    expect(bundleLink({ type: 'game.chess', v: 1, path: '/dining-today/crown-grill' })).toBeNull()
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

describe('B7 types: port, place and dish', () => {
  it('are in the registry and are refs, and none is plannable', () => {
    for (const type of ['port', 'place', 'dish']) {
      expect(isKnownBundle({ type, v: 1 })).toBe(true)
      expect(REF_TYPES).toContain(type)
      expect(isPlannable({ type, day: 2 })).toBe(false)
    }
  })
  it('send as bundles', () => {
    expect(shareInput('port:cozumel', 'card').kind).toBe('bundle')
    expect(shareInput('dish:crown-grill:filet-mignon', 'card').kind).toBe('bundle')
  })
  it('opens a port guide and a restaurant page', () => {
    expect(bundleLink({ type: 'port', v: 1, path: '/home/ports/cozumel' })).toBe('/home/ports/cozumel')
    expect(bundleLink({ type: 'dish', v: 1, path: '/dining-today/crown-grill' })).toBe('/dining-today/crown-grill')
  })
})

/** The coverage list: every explorer item worth sharing names its bundle type, or says why it has none, so nothing is missed silently. */
export const BUNDLE_COVERAGE: Readonly<Record<string, string>> = {
  'venue page': 'venue',
  'menu': 'menu',
  'dish': 'dish',
  'programme or Explorer event': 'event',
  'excursion': 'excursion',
  'dinner': 'dinner',
  'port guide': 'port',
  'place on the ship': 'place',
  'day summary and trip itinerary': 'none yet: arrives with the day board follow-up (Add all to my day)',
  'shortlist': 'none yet: waits for the huddle work',
  'game (Sudoku family, Binairo)': 'game.sudoku',
  'game (other twelve)': 'none yet: arrives with B9',
}

describe('bundle coverage', () => {
  it('names a registered type, or a reason, for each explorer item', () => {
    for (const [item, how] of Object.entries(BUNDLE_COVERAGE)) {
      expect(item).not.toBe('')
      expect(how in BUNDLE_TYPES || how.startsWith('none yet: ')).toBe(true)
    }
  })
})

describe('game bundles', () => {
  const sent = { type: 'game.sudoku', v: 1, title: 'Sudoku', ref: 'game:sudoku:current', data: 'd=easy;p=0' }
  it('are in the registry for each shareable game and read their puzzle text and way of sending', () => {
    for (const id of ['sudoku', 'diagonal-sudoku', 'jigsaw-sudoku', 'killer-sudoku', 'binairo', 'futoshiki', 'kenken', 'hitori', 'crossmath', 'kakuro', 'slitherlink', 'nurikabe', 'hashi', 'nonogram', 'cruise-wordle', 'word-search', 'codeword', 'minesweeper']) expect(`game.${id}` in BUNDLE_TYPES).toBe(true)
    expect(gameOfBundle(sent)).toEqual({ game: 'sudoku', mode: 'current', data: 'd=easy;p=0' })
    expect(gameOfBundle({ ...sent, ref: 'game:binairo:current' })).toBeNull()
    expect(gameOfBundle({ ...sent, ref: 'game:sudoku:later' })).toBeNull()
    expect(gameOfBundle({ ...sent, data: undefined })).toBeNull()
    expect(gameOfBundle({ ...sent, ref: 'game:sudoku:result', data: 'd=easy;p=0;tm=552' })).toEqual({ game: 'sudoku', mode: 'result', data: 'd=easy;p=0;tm=552', seconds: 552 })
    expect(gameOfBundle({ ...sent, ref: 'game:sudoku:result' })).toBeNull()
    expect(gameOfBundle({ ...sent, ref: 'game:sudoku:result', data: 'd=easy;p=0;tm=0' })).toBeNull()
    expect(gameOfBundle({ type: 'venue', ref: 'venue:x' })).toBeNull()
  })
  it('keep puzzle text only when it is plain and small', () => {
    expect(parseBundle(sent)?.data).toBe('d=easy;p=0')
    expect(parseBundle({ ...sent, data: 'd=easy<b>' })?.data).toBeUndefined()
    expect(parseBundle({ ...sent, data: 'a'.repeat(4001) })?.data).toBeUndefined()
    expect(parseBundle({ ...sent, data: 5 })?.data).toBeUndefined()
  })
  it('open the game screen from the registry path', () => {
    expect(bundleLink({ type: 'game.sudoku', v: 1, path: '/games-explorer/sudoku' })).toBe('/games-explorer/sudoku')
    expect(bundleLink({ type: 'game.sudoku', v: 1, path: '/games-explorer/../admin' })).toBeNull()
  })
})

describe('forwardInput', () => {
  it('sends only the ref, the puzzle text and the note', () => {
    const b = { type: 'venue', v: BUNDLE_VERSION, ref: 'venue:crown-grill' }
    expect(forwardInput(b, 'look')).toEqual({ kind: 'bundle', shareRef: 'venue:crown-grill', note: 'look' })
    expect(forwardInput({ ...b, data: 'a=1' })).toEqual({ kind: 'bundle', shareRef: 'venue:crown-grill', data: 'a=1' })
  })
  it('refuses a bundle with no ref or an unknown type', () => {
    expect(forwardInput({ type: 'venue', v: BUNDLE_VERSION })).toBeNull()
    expect(forwardInput({ type: 'nope', v: BUNDLE_VERSION, ref: 'x:1' })).toBeNull()
  })
})
