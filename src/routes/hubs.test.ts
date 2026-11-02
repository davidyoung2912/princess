import { describe, expect, it } from 'vitest'
import { searchContent } from '../domain/searchIndex'
import { parseRecent, pushRecent } from '../domain/recentSearches'
import { t } from '../i18n'
import { HUBS, JOURNEY_OF_STAGE, JOURNEY_STAGES, QUICK, STAGE_ACTION, depthOf, hubFor, hubProblems, stageOfPath } from './hubs'
import { ROUTES } from './routes'
import { FIND_TASKS, SCREEN_WORDS, screenHits } from './screenWords'
import { STAGE_IDS } from '../domain/sailings'

const inJourney = ROUTES.filter((r) => r.tab !== null && r.path !== '/kit' && !r.public)

describe('hubs and depth (N2.2, N2.4)', () => {
  it('has no problems: every screen is in one hub of its tab and at most three taps from launch', () => {
    expect(hubProblems()).toEqual([])
  })

  it('gives every screen a stage, a hub (or a list it comes from) and a depth of at most three', () => {
    for (const r of inJourney) {
      expect(stageOfPath(r.path), r.path).not.toBeNull()
      expect(depthOf(r.path), r.path).toBeLessThanOrEqual(3)
      if (!['/', '/plan', '/ship', '/chat', '/me'].includes(r.path)) expect(hubFor(r.path), r.path).not.toBeNull()
    }
  })

  it('keeps the fifteen top tasks at two taps, because their screens are kept on the tab front page', () => {
    for (const p of ['/home/boarding-pass', '/plan/reservations', '/plan/excursions', '/ship/order', '/me/bill', '/ship/map', '/ship/family', '/me/packages', '/me/settings']) expect(depthOf(p), p).toBeLessThanOrEqual(2)
  })

  it('is about eight to ten hubs a tab at most, each with a label', () => {
    for (const tab of ['home', 'plan', 'ship', 'me'] as const) expect(HUBS.filter((h) => h.tab === tab).length).toBeLessThanOrEqual(8)
    for (const h of HUBS) expect(t(h.labelKey).length, h.id).toBeGreaterThan(3)
  })

  it('catches a screen filed in no hub', () => {
    const hub = HUBS.find((h) => h.id === 'plan.wish')!
    const saved = hub.paths
    ;(hub as { paths: readonly string[] }).paths = saved.filter((p) => p !== '/plan/gifts')
    try {
      expect(hubProblems().some((p) => p.includes('/plan/gifts'))).toBe(true)
    } finally {
      ;(hub as { paths: readonly string[] }).paths = saved
    }
  })

  it('only quick-links screens that are also in a hub', () => {
    for (const list of Object.values(QUICK)) for (const p of list) expect(hubFor(p), p).not.toBeNull()
  })
})

describe('journey stages (N2.1)', () => {
  it('maps every point of the sailing to one of the eleven stages and gives each stage an action on a real screen', () => {
    expect(JOURNEY_STAGES).toHaveLength(11)
    for (const id of STAGE_IDS) expect(JOURNEY_STAGES).toContain(JOURNEY_OF_STAGE[id])
    const known = new Set(ROUTES.map((r) => r.path))
    for (const s of JOURNEY_STAGES) {
      expect(known.has(STAGE_ACTION[s]), s).toBe(true)
      expect(t(`journey.stage.${s}`).length).toBeGreaterThan(2)
      expect(t(`journey.go.${s}`).length).toBeGreaterThan(5)
    }
  })
})

describe('one search (N2.3)', () => {
  const hits = (q: string) => searchContent(q, screenHits(t)).map((h) => h.to)

  it('has at least two plain phrases for every screen', () => {
    for (const r of ROUTES.filter((x) => x.tab !== null && !x.path.includes(':') && x.path !== '/kit')) {
      const phrases = (SCREEN_WORDS[r.path] ?? '').split(';').map((x) => x.trim()).filter(Boolean)
      expect(phrases.length, r.path).toBeGreaterThanOrEqual(2)
    }
  })

  it('finds each screen by two of its plain phrases', () => {
    const misses: string[] = []
    for (const [path, words] of Object.entries(SCREEN_WORDS)) {
      const phrases = words.split(';').map((x) => x.trim()).filter((x) => x.length >= 2)
      const found = phrases.filter((p) => hits(p).includes(path))
      if (found.length < 2) misses.push(`${path} found by ${found.length} of ${phrases.length}`)
    }
    expect(misses).toEqual([])
  })

  it('has no phrase for a screen that does not exist', () => {
    const known = new Set(ROUTES.map((r) => r.path))
    for (const p of Object.keys(SCREEN_WORDS)) expect(known.has(p), p).toBe(true)
  })

  it('finds the 25 stage tasks in the first five results (Search, then the result: two taps)', () => {
    expect(FIND_TASKS).toHaveLength(25)
    for (const task of FIND_TASKS) expect(hits(task.phrase).slice(0, 5), `${task.id}: ${task.phrase}`).toContain(task.path)
  })

  it('finds the examples from the plan: allergy, taxi price, late, towel', () => {
    expect(hits('allergy')).toContain('/plan/allergy')
    expect(hits('taxi price')).toContain('/home/disembark/onward')
    expect(hits('late')).toContain('/home/delayed')
    expect(hits('towel')).toContain('/ship/requests')
  })
})

describe('recent searches', () => {
  it('keeps the newest first, without repeats, at most five', () => {
    let list = pushRecent([], { to: '/a', title: 'A' })
    for (const x of ['b', 'c', 'd', 'e', 'f']) list = pushRecent(list, { to: `/${x}`, title: x })
    list = pushRecent(list, { to: '/d', title: 'D' })
    expect(list.map((r) => r.to)).toEqual(['/d', '/f', '/e', '/c', '/b'])
  })

  it('reads a stored list safely', () => {
    expect(parseRecent(null)).toEqual([])
    expect(parseRecent('nonsense')).toEqual([])
    expect(parseRecent('{"to":"/x"}')).toEqual([])
    expect(parseRecent('[{"to":"https://evil.example","title":"x"},{"to":"/ok","title":"Ok"},{"to":1}]')).toEqual([{ to: '/ok', title: 'Ok' }])
  })
})
