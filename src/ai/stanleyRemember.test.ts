import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import type { StanleyCase } from './stanleyHandoff'
import {
  askPortMemory, buildMilestones, correctLine, costRange, dailyRecap, draftCaption, draftFeedback, mayPromoteRebooking, nextVoyageIdeas, normalizeStory, openFromCases, openFromHandoffs, rebookGate, removedLines,
  removeLine, renderStory, restoreLine, setTone, storyLines, EMPTY_STORY, TONES, VERSIONS, CAPTION_MAX, futureInterests, groupFavouritesByDay, interestMatches, type StoryFacts,
} from './stanleyRemember'
import type { TripEntry } from '../domain/tripDiary'

const facts: StoryFacts = { party: ['Ana', 'Ben'], shipName: 'Sun Princess', cruiseName: 'Mexico', nights: 7, dates: '1 to 8 Mar', ports: ['Cozumel', 'Roatán'], seaDays: 3, tourNames: ['Snorkel trip'], favouriteMeal: { name: 'Crown Grill', times: 2 }, photos: 12 }
const journal = { 2: 'Ben dropped his hat in the sea.', 4: '  ' }
const entry = (o: Partial<TripEntry>): TripEntry => ({ id: 'e', sailingId: 's', day: 2, at: 1, kind: 'note', text: 'x', mood: null, auto: false, key: '', ...o })

describe('Voyage Story', () => {
  const ms = buildMilestones(facts, journal)

  it('gives every line a source and creates nothing the facts do not hold', () => {
    expect(ms.every((m) => m.source !== '' && m.text !== '')).toBe(true)
    expect(ms.map((m) => m.id)).toEqual(['trip', 'ports', 'tour:Snorkel trip', 'meal', 'photos', 'note:2'])
    const bare = buildMilestones({ ...facts, ports: [], tourNames: [], favouriteMeal: null, photos: 0 }, {})
    expect(bare.map((m) => m.id)).toEqual(['trip'])
  })

  it('keeps private notes out of the family and public versions, and names out of the public one', () => {
    const lines = (v: (typeof VERSIONS)[number]) => storyLines(ms, EMPTY_STORY, v).map((l) => l.id)
    expect(lines('private')).toContain('note:2')
    expect(lines('family')).not.toContain('note:2')
    expect(lines('family')).toContain('meal')
    expect(lines('public')).toEqual(['trip', 'ports'])
    expect(renderStory(facts, ms, EMPTY_STORY, 'public').text).not.toMatch(/Ana|Ben|Crown|Snorkel/)
    expect(renderStory(facts, ms, EMPTY_STORY, 'family').title).toContain('Ana and Ben')
  })

  it('removes and restores a line, and a correction replaces the words but keeps the audience', () => {
    const gone = removeLine(EMPTY_STORY, 'meal')
    expect(storyLines(ms, gone, 'family').map((l) => l.id)).not.toContain('meal')
    expect(removedLines(ms, gone, 'family').map((m) => m.id)).toEqual(['meal'])
    expect(storyLines(ms, restoreLine(gone, 'meal'), 'family').map((l) => l.id)).toContain('meal')
    const fixed = correctLine(EMPTY_STORY, 'note:2', 'Ben lost his hat.')
    expect(storyLines(ms, fixed, 'private').find((l) => l.id === 'note:2')).toMatchObject({ text: 'Ben lost his hat.', corrected: true })
    expect(storyLines(ms, fixed, 'public').some((l) => l.id === 'note:2')).toBe(false)
    expect(correctLine(fixed, 'note:2', '  ').corrected).toEqual({})
    expect(removeLine(fixed, 'note:2').corrected).toEqual({})
  })

  it('changes only the opening and closing words with the tone, never a sourced line', () => {
    const texts = TONES.map((tone) => renderStory(facts, ms, setTone(EMPTY_STORY, tone), 'private'))
    expect(new Set(texts.map((s) => s.opening)).size).toBe(TONES.length)
    for (const s of texts) expect(s.lines.map((l) => l.text)).toEqual(texts[0].lines.map((l) => l.text))
  })

  it('reads saved choices defensively', () => {
    expect(normalizeStory(null)).toEqual(EMPTY_STORY)
    const s = normalizeStory({ tone: 'loud', removed: ['a', 'a', 7, ''], corrected: { b: ' hi  there ', c: '' } })
    expect(s).toEqual({ tone: 'warm', removed: ['a'], corrected: { b: 'hi there' } })
  })
})

describe('drafts', () => {
  it('writes feedback only from what the guest picked, and a low rating asks for a person', () => {
    const base = { crew: [], thanks: [], tone: 'plain' as const, overall: 0, liked: [], disliked: [] }
    expect(draftFeedback(base, 1000)).toBe('Thank you.')
    const d = draftFeedback({ ...base, crew: ['Maria', 'Jo'], thanks: ['kind', 'quick'], liked: ['Dining'], disliked: ['Cabin'], overall: 2 }, 1000)
    expect(d).toContain('Maria and Jo')
    expect(d).toContain('kind and quick to help')
    expect(d).toContain('Dining')
    expect(d).toContain('Cabin')
    expect(d).toContain('someone to look at this')
    expect(draftFeedback({ ...base, overall: 5 }, 1000)).not.toContain('look at this')
    expect(draftFeedback({ ...base, crew: ['Maria'], tone: 'warm' }, 20).length).toBeLessThanOrEqual(20)
  })

  it('captions from the day and diary, within the limit, and names nobody', () => {
    const c = draftCaption({ port: 'Cozumel', day: 2, tone: 'warm', diary: [entry({ kind: 'tour', text: 'Snorkel trip' })] })
    expect(c).toContain('Cozumel')
    expect(c).toContain('Snorkel trip')
    expect(draftCaption({ port: null, day: 3, tone: 'plain', diary: [] })).toContain('A day at sea, day 3')
    expect(draftCaption({ port: 'Cozumel', day: 2, tone: 'warm', diary: [entry({ kind: 'note', text: 'y'.repeat(300) })] }).length).toBeLessThanOrEqual(CAPTION_MAX)
  })

  it('recaps only the guest’s diary lines for the day and asks about a port once nothing of theirs is kept', () => {
    const list = [entry({ id: 'a', kind: 'meal', text: 'Crown Grill', at: 5, auto: true }), entry({ id: 'b', kind: 'port', text: 'Cozumel', at: 2, auto: true }), entry({ id: 'c', kind: 'booked', text: 'Booked' }), entry({ id: 'd', day: 3, text: 'other day' })]
    expect(dailyRecap(list, 2)).toEqual(['Cozumel', 'Crown Grill'])
    expect(dailyRecap(list, 9)).toEqual([])
    expect(askPortMemory(list, 2, 'Cozumel')).toBe(true)
    expect(askPortMemory(list, 2, null)).toBe(false)
    expect(askPortMemory([...list, entry({ id: 'n', kind: 'note', text: 'Lovely' })], 2, 'Cozumel')).toBe(false)
  })
})

describe('open cases and rebooking', () => {
  const now = 1_000_000
  const handoff = (o: Partial<StanleyCase>): StanleyCase => ({ id: 'h1', topic: 'billing', reference: 'GS-ABC123', owner: 'Guest Services', status: 'acknowledged', openedAt: 0, nextUpdateAt: now + 1000, overdue: false, escalated: false, issue: '', outcome: '', ...o })

  it('does not promote while any case is open, and holds back entirely for a serious one', () => {
    expect(rebookGate([]).mode).toBe('normal')
    expect(mayPromoteRebooking(rebookGate([]))).toBe(true)
    const billing = openFromHandoffs([handoff({})], now)
    expect(rebookGate(billing).mode).toBe('soften')
    expect(mayPromoteRebooking(rebookGate(billing))).toBe(false)
    for (const topic of ['missedShip', 'disruption', 'allergy'] as const) expect(rebookGate(openFromHandoffs([handoff({ topic })], now)).mode).toBe('hold')
    expect(rebookGate(openFromHandoffs([handoff({ overdue: true })], now)).mode).toBe('hold')
    expect(rebookGate(openFromHandoffs([handoff({ escalated: true })], now)).mode).toBe('hold')
    expect(rebookGate(openFromHandoffs([handoff({ nextUpdateAt: now - 1 })], now)).mode).toBe('hold')
  })

  it('ignores settled cases and reads the post-cruise kinds', () => {
    expect(openFromHandoffs([handoff({ status: 'fulfilled', topic: 'missedShip' })], now)).toEqual([])
    const post = (kind: string, stage: string) => openFromCases([{ id: '1', kind, number: 'C-1', stage }])
    expect(post('complaint', 'resolved')).toEqual([])
    expect(post('complaint', 'withdrawn')).toEqual([])
    expect(rebookGate(post('lostItem', 'received')).mode).toBe('soften')
    for (const kind of ['claim', 'complaint', 'recovery']) expect(rebookGate(post(kind, 'inReview')).mode).toBe('hold')
    expect(rebookGate([...openFromHandoffs([handoff({})], now), ...post('claim', 'received')]).cases).toHaveLength(2)
  })
})

describe('next-voyage ideas', () => {
  const voyages = [
    { id: 'a', departure: '2027-03-01', places: ['Cozumel, Mexico', 'Roatán, Honduras'], totalCents: 300000 },
    { id: 'b', departure: '2027-02-01', places: ['Cozumel, Mexico'], totalCents: 250000 },
    { id: 'c', departure: '2027-01-01', places: ['Juneau, Alaska'], totalCents: 100000 },
  ]
  it('suggests only sailings that call where the guest said, most matches first, with the reason', () => {
    const ideas = nextVoyageIdeas(['Cozumel', 'Roatan'], voyages)
    expect(ideas.map((i) => i.id)).toEqual(['a', 'b'])
    expect(ideas[0].because.map((b) => b.want)).toEqual(['Cozumel', 'Roatan'])
    expect(nextVoyageIdeas([], voyages)).toEqual([])
    expect(costRange(ideas)).toEqual({ low: 250000, high: 300000 })
    expect(costRange([])).toBeNull()
  })
})

describe('next-voyage ideas from kept interests', () => {
  const tours = [
    { port: 'cozumel', interests: ['water'], family: true }, { port: 'cozumel', interests: ['water', 'culture'], family: false },
    { port: 'roatan', interests: ['water'], family: false }, { port: 'juneau', interests: ['nature'], family: false },
  ]
  it('keeps only future interests that tours can back', () => {
    const items = [
      { kind: 'interest', value: 'water', scope: 'future' }, { kind: 'interest', value: 'water', scope: 'future' }, { kind: 'interest', value: 'culture', scope: 'trip' },
      { kind: 'interest', value: 'food', scope: 'future' }, { kind: 'pace', value: 'slow', scope: 'future' }, { kind: 'interest', value: 'family', scope: 'future' },
    ]
    expect(futureInterests(items)).toEqual(['water', 'family'])
  })
  it('matches an interest to the port with most tours, and claims nothing without a tour', () => {
    expect(interestMatches(['water', 'family', 'challenge'], ['roatan', 'cozumel'], tours)).toEqual([{ interest: 'water', portId: 'cozumel', count: 2 }, { interest: 'family', portId: 'cozumel', count: 1 }])
    expect(interestMatches(['water'], ['juneau'], tours)).toEqual([])
  })
  it('suggests a sailing from interests alone and ranks it with the wants', () => {
    const voyages = [
      { id: 'a', departure: '2027-03-01', places: ['Juneau'], portIds: ['juneau'], totalCents: 1 },
      { id: 'b', departure: '2027-02-01', places: ['Cozumel'], portIds: ['cozumel'], totalCents: 2 },
      { id: 'c', departure: '2027-04-01', places: ['Roatán'], portIds: ['roatan'], totalCents: 3 },
    ]
    const ideas = nextVoyageIdeas(['Roatan'], voyages, 3, ['water'], tours)
    expect(ideas.map((i) => i.id)).toEqual(['c', 'b'])
    expect(ideas[0].because).toHaveLength(1)
    expect(ideas[0].byInterest[0]).toMatchObject({ interest: 'water', portId: 'roatan' })
  })
})

describe('photo organiser', () => {
  const photos = [
    { id: 'p3', day: 3, title: 'Beach', time: '10:00' }, { id: 'p1', day: 2, title: 'Pool', time: '15:00' }, { id: 'p2', day: 2, title: 'Gangway', time: '09:00' }, { id: 'p4', day: 4, title: 'Not a favourite', time: '09:00' },
  ]
  it('groups only favourites by day, oldest first, ordered by time, with a caption from the diary', () => {
    const g = groupFavouritesByDay(photos, ['p1', 'p2', 'p3'], (d) => (d === 2 ? 'Cozumel' : null), [entry({ day: 2, kind: 'tour', text: 'Snorkel trip' })], 'plain')
    expect(g.map((x) => x.day)).toEqual([2, 3])
    expect(g[0].photoIds).toEqual(['p2', 'p1'])
    expect(g[0].caption).toContain('Snorkel trip')
    expect(g[1].caption).toContain('A day at sea, day 3')
    expect(g.flatMap((x) => x.photoIds)).not.toContain('p4')
    expect(groupFavouritesByDay(photos, [], () => null, [], 'warm')).toEqual([])
  })
})

describe('strings', () => {
  it('has every phase 13 string the module and screens use', () => {
    for (const k of ['rem13.hold.serious', 'rem13.ideas.range', 'rem13.version.public.note', 'rem13.story.removed_one', 'rem13.story.removed_other']) expect(k in en, k).toBe(true)
    for (const tone of TONES) for (const part of ['open', 'close', 'thanksOpen', 'caption']) expect(`rem13.tone.${tone}.${part}` in en).toBe(true)
  })
})
