import { describe, expect, it } from 'vitest'
import { JOURNEY_STAGES } from './hubs'
import { routeForPath } from './nav'
import { accessAt } from './stageNav'
import { EMPTY_WELCOME, hasWelcomeCopy, MAX_WELCOME_ENTRIES, needId, normalizeTicks, markWelcomeSeen, mergeWelcome, normalizeWelcome, SAILING_STAGES, shouldShowWelcome, unmarkWelcome, welcomeContent, welcomeKey, welcomeKeys } from './stageWelcome'
import { en } from '../i18n/locales/en'

describe('welcome keys', () => {
  it('is the stage alone before a booking and stage plus sailing after', () => {
    expect(welcomeKey('dream', 'sun-1')).toBe('dream')
    expect(welcomeKey('book', 'sun-1')).toBe('book')
    expect(welcomeKey('manage', 'sun-1')).toBe('manage:sun-1')
    expect(welcomeKey('remember', 'alaska_2027.06')).toBe('remember:alaska_2027.06')
    expect(SAILING_STAGES).toEqual(JOURNEY_STAGES.slice(3))
  })

  it('leaves out a missing sailing or one the server would refuse', () => {
    expect(welcomeKey('manage', null)).toBe('manage')
    expect(welcomeKey('manage', undefined)).toBe('manage')
    expect(welcomeKey('manage', 'has space')).toBe('manage')
    expect(welcomeKey('manage', 'x'.repeat(65))).toBe('manage')
  })
})

describe('reading and merging the document', () => {
  it('drops unknown stages, odd sailing ids and non-numbers', () => {
    const raw = { seen: { dream: 1, nope: 2, 'manage:ok-1': 3, 'manage:a/b': 4, 'manage:': 5, sea: 'x', port: Number.NaN } }
    expect(normalizeWelcome(raw).seen).toEqual({ dream: 1, 'manage:ok-1': 3 })
    for (const bad of [null, 'x', 4, {}, { seen: [] }, { seen: 'x' }]) expect(normalizeWelcome(bad)).toBe(EMPTY_WELCOME)
  })

  it('keeps only the newest entries when there are too many', () => {
    const seen = Object.fromEntries(Array.from({ length: MAX_WELCOME_ENTRIES + 5 }, (_, i) => [`manage:s${i}`, i]))
    const kept = normalizeWelcome({ seen }).seen
    expect(Object.keys(kept)).toHaveLength(MAX_WELCOME_ENTRIES)
    expect(kept['manage:s0']).toBeUndefined()
    expect(kept[`manage:s${MAX_WELCOME_ENTRIES + 4}`]).toBe(MAX_WELCOME_ENTRIES + 4)
  })

  it('merges two devices: every welcome, the earliest time for one both saw', () => {
    const merged = mergeWelcome({ seen: { dream: 10, discover: 20 } }, { seen: { dream: 5, book: 30 } })
    expect(merged.seen).toEqual({ dream: 5, discover: 20, book: 30 })
    expect(mergeWelcome(null, null)).toBe(EMPTY_WELCOME)
  })
})

describe('marking seen', () => {
  it('records once and returns the same state for a repeat or a bad key', () => {
    const one = markWelcomeSeen(EMPTY_WELCOME, 'dream', 100)
    expect(one.seen).toEqual({ dream: 100 })
    expect(markWelcomeSeen(one, 'dream', 200)).toBe(one)
    expect(markWelcomeSeen(one, 'nonsense', 200)).toBe(one)
    expect(EMPTY_WELCOME.seen).toEqual({})
  })
})

describe('unmarking', () => {
  it('forgets one welcome, and is a no-op for one not seen', () => {
    const two = markWelcomeSeen(markWelcomeSeen(EMPTY_WELCOME, 'dream', 1), 'book', 2)
    expect(unmarkWelcome(two, 'dream').seen).toEqual({ book: 2 })
    expect(unmarkWelcome(two, 'sea')).toBe(two)
    expect(unmarkWelcome(markWelcomeSeen(EMPTY_WELCOME, 'dream', 1), 'dream')).toBe(EMPTY_WELCOME)
  })
})

describe('shouldShowWelcome', () => {
  const seen = markWelcomeSeen(EMPTY_WELCOME, 'manage:sun-1', 1)

  it('shows an unseen stage once the documents have arrived', () => {
    expect(shouldShowWelcome('dream', null, EMPTY_WELCOME, true)).toBe(true)
    expect(shouldShowWelcome('dream', null, markWelcomeSeen(EMPTY_WELCOME, 'dream', 1), true)).toBe(false)
  })

  it('shows nothing before the documents arrive or when there is no stage', () => {
    expect(shouldShowWelcome('dream', null, EMPTY_WELCOME, false)).toBe(false)
    expect(shouldShowWelcome(null, null, EMPTY_WELCOME, true)).toBe(false)
  })

  it('treats the same stage on another sailing as new', () => {
    expect(shouldShowWelcome('manage', 'sun-1', seen, true)).toBe(false)
    expect(shouldShowWelcome('manage', 'sun-2', seen, true)).toBe(true)
    expect(shouldShowWelcome('prebook', 'sun-1', seen, true)).toBe(true)
  })
})

describe('the welcome route', () => {
  it('opens at every stage and is never treated as a stale address', () => {
    for (const stage of JOURNEY_STAGES) expect(accessAt('/welcome', '/welcome', stage), stage).toBe('show')
  })
})

describe('welcome content', () => {
  it('has an intro for the first stage and a transition for the rest, with neighbours in order', () => {
    const first = welcomeContent('dream')
    expect([first.previous, first.next, first.introKey, first.transitionKey]).toEqual([null, 'discover', 'welcome.dream.intro', null])
    const mid = welcomeContent('sea')
    expect([mid.previous, mid.next, mid.introKey, mid.transitionKey]).toEqual(['embark', 'port', null, 'welcome.sea.transition'])
    expect(welcomeContent('remember').next).toBeNull()
  })

  it('gives every stage three steps that open real screens', () => {
    for (const stage of JOURNEY_STAGES) {
      const { steps } = welcomeContent(stage)
      expect(steps, stage).toHaveLength(3)
      steps.forEach((s, i) => {
        expect(s.key).toBe(`welcome.${stage}.step.${i + 1}`)
        expect(routeForPath(s.to), `${stage}: ${s.to}`).toBeDefined()
      })
    }
  })

  it('gives every stage three or four things to have ready, each pointing at a real screen or nowhere', () => {
    for (const stage of JOURNEY_STAGES) {
      const { needs } = welcomeContent(stage)
      expect(needs.length, stage).toBeGreaterThanOrEqual(3)
      expect(needs.length, stage).toBeLessThanOrEqual(4)
      needs.forEach((n, i) => {
        expect(n.key).toBe(`welcome.${stage}.need.${i + 1}`)
        if (n.to) expect(routeForPath(n.to), `${stage}: ${n.to}`).toBeDefined()
      })
    }
  })

  it('reads stored ticks safely', () => {
    expect(needId('book', 2)).toBe('book.2')
    expect(normalizeTicks({ 'book.2': true, 'book.9': true, 'nope.1': true, 'dream.1': 'yes', 'sea.0': true, 'sea.1': true })).toEqual({ 'book.2': true, 'sea.1': true })
    for (const bad of [null, 'x', [], 4]) expect(normalizeTicks(bad)).toEqual({})
  })

  it('lists the locale keys each stage needs', () => {
    expect(welcomeKeys('dream')).toEqual(['welcome.dream.title', 'welcome.dream.intro', 'welcome.dream.focus', 'welcome.dream.needIntro', 'welcome.dream.need.1', 'welcome.dream.need.2', 'welcome.dream.need.3', 'welcome.dream.lead', 'welcome.dream.step.1', 'welcome.dream.step.2', 'welcome.dream.step.3'])
    expect(welcomeKeys('port')).toContain('welcome.port.transition')
  })

  it('has English text for every key', () => {
    for (const stage of JOURNEY_STAGES) for (const k of welcomeKeys(stage)) expect((en as Record<string, string>)[k], k).toBeTruthy()
    for (const stage of JOURNEY_STAGES) expect(hasWelcomeCopy(stage), stage).toBe(true)
  })
})
