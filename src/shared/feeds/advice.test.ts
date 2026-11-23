import { afterEach, describe, expect, it } from 'vitest'
import { normalizeCabinGuide } from './cabinGuide'
import { embarkFeed, normalizeEmbarkQueue } from './embark'
import { friendReplyFeed, normalizeFriendReply } from './friend'
import { normalizeQuality, qualityFeed } from './sailingQuality'

afterEach(() => { for (const f of [qualityFeed, friendReplyFeed]) { f.setFetcher(null); f.forget() } })

const note = (key: string, level = 'low') => ({ key, level, text: `${key} text`, why: `${key} why` })
const quality = { sailingId: 'sun-2027-03-21', source: 'sim', notes: ['crowds', 'weather', 'hurricane', 'school', 'price'].map((k) => note(k)) }

describe('sailing quality feed', () => {
  it('reads the five notes in order and refuses anything else', () => {
    expect(normalizeQuality(quality)?.notes.map((n) => n.key)).toEqual(['crowds', 'weather', 'hurricane', 'school', 'price'])
    expect(normalizeQuality({ ...quality, notes: quality.notes.slice(1) })).toBeNull()
    expect(normalizeQuality({ ...quality, notes: [note('weather'), ...quality.notes.slice(1)] })).toBeNull()
    expect(normalizeQuality({ ...quality, notes: [note('crowds', 'extreme'), ...quality.notes.slice(1)] })).toBeNull()
    expect(normalizeQuality(null)).toBeNull()
  })
  it('knows nothing until the server answers', async () => {
    expect(qualityFeed.now('sun-2027-03-21')).toBeNull()
    qualityFeed.setFetcher(async () => quality)
    expect(await qualityFeed.load('sun-2027-03-21')).toBe(true)
  })
})

describe('friend reply feed', () => {
  it('reads accepted or declined only', () => {
    expect(normalizeFriendReply({ reply: 'accepted' })).toBe('accepted')
    expect(normalizeFriendReply({ reply: 'declined' })).toBe('declined')
    expect(normalizeFriendReply({ reply: 'maybe' })).toBeNull()
  })
  it('asks once per name, ignoring case', async () => {
    let calls = 0
    friendReplyFeed.setFetcher(async () => { calls++; return { reply: 'declined' } })
    expect(await friendReplyFeed.load('Sam')).toBe(true)
    expect(await friendReplyFeed.load('SAM')).toBe(false)
    expect(friendReplyFeed.now('sam')).toBe('declined')
    expect(calls).toBe(1)
  })
})

describe('embark queue feed', () => {
  const step = (id: string) => ({ id, walk: 3, queue: 4, accessibleLane: true, quietLane: id === 'security' })
  const win = (start: string, crowd = 'quiet') => ({ start, end: '12:00', crowd, waitMinutes: 10, total: 28, steps: ['terminal', 'security', 'photo', 'gangway'].map(step) })
  it('reads windows with their four steps and a recommended start that is one of them', () => {
    const q = normalizeEmbarkQueue({ windows: [win('11:00'), win('11:30', 'busy')], recommended: '11:00', source: 'sim' })
    expect(q?.windows).toHaveLength(2)
    expect(q?.recommended).toBe('11:00')
    expect(normalizeEmbarkQueue({ windows: [], recommended: null })?.recommended).toBeNull()
  })
  it('refuses a missing step, a wrong crowd or a recommendation for a window that is not there', () => {
    expect(normalizeEmbarkQueue({ windows: [{ ...win('11:00'), steps: [] }], recommended: null })).toBeNull()
    expect(normalizeEmbarkQueue({ windows: [win('11:00', 'packed')], recommended: null })).toBeNull()
    expect(normalizeEmbarkQueue({ windows: [win('11:00')], recommended: '13:00' })).toBeNull()
    expect(normalizeEmbarkQueue(null)).toBeNull()
  })
  it('knows nothing until the server answers', () => {
    expect(embarkFeed.now(false, false, false, '')).toBeNull()
  })
})

describe('cabin guide feed', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    cabin: { number: '10101', deck: 10, position: 'midship', side: 'port', notes: ['Near the elevators'], obstructed: false, accessible: false, available: true },
    category: 'balcony', sleep: 4, motion: 5, noise: 3, reasons: { sleep: ['s'], motion: ['m'], noise: ['n'] }, sun: null, warnings: [], ...over,
  })
  it('reads scored cabins and refuses scores outside 1 to 5, unknown positions and bad suns', () => {
    expect(normalizeCabinGuide({ cabins: [row()] })).toHaveLength(1)
    expect(normalizeCabinGuide({ cabins: [row({ sleep: 6 })] })).toBeNull()
    expect(normalizeCabinGuide({ cabins: [row({ category: 'penthouse' })] })).toBeNull()
    expect(normalizeCabinGuide({ cabins: [row({ cabin: { ...row().cabin, position: 'roof' } })] })).toBeNull()
    expect(normalizeCabinGuide({ cabins: [row({ sun: { label: 'blazing' } })] })).toBeNull()
    expect(normalizeCabinGuide({ cabins: [row({ sun: { mornings: 3, afternoons: 2, portAfternoons: 1, label: 'both', text: 'Hat.' } })] })?.[0].sun?.label).toBe('both')
    expect(normalizeCabinGuide(null)).toBeNull()
  })
})
