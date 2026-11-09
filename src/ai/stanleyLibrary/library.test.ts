import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/locales/en'
import { SCREEN_BY_ID, SCREEN_LIST } from '../../routes/screens'
import { ALL_TAB_KEYS } from '../../routes/stageNav'
import { DEFAULT_SETTINGS, stanleyLevelFor } from '../../settings/settings'
import { LIBRARY, MAX_CHIPS, PAGE_QA, answerOf, chipsFor, matchQuestion, questionOf } from '.'

const staticPaths = new Set(SCREEN_LIST.map((s) => s.path).filter((p) => !p.includes(':')))

describe('Stanley library', () => {
  it('has 129 entries with unique ids across eleven stages', () => {
    expect(LIBRARY).toHaveLength(129)
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(129)
    for (const stage of ['dream', 'discover', 'book', 'manage', 'prebook', 'getToShip'] as const) expect(LIBRARY.filter((e) => e.stages.includes(stage)).length).toBeGreaterThanOrEqual(13)
    for (const stage of ['embark', 'sea', 'port', 'disembark', 'remember'] as const) expect(LIBRARY.filter((e) => e.stages.includes(stage)).length).toBe(10)
  })

  it('has a question and an answer for every entry, in his voice', () => {
    for (const e of LIBRARY) {
      expect(`stanley.q.${e.id}` in en, e.id).toBe(true)
      expect(`stanley.a.${e.id}` in en, e.id).toBe(true)
      const q = questionOf(e)
      const a = answerOf(e)
      expect(q.length, e.id).toBeLessThanOrEqual(60)
      expect(q.endsWith('?'), e.id).toBe(true)
      expect(a.length, e.id).toBeLessThanOrEqual(260)
      expect(a, e.id).not.toMatch(/!/)
      expect(a, e.id).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
    }
  })

  it('names only real screens and real static paths', () => {
    for (const e of LIBRARY) {
      for (const id of e.screens) expect(SCREEN_BY_ID.has(id), `${e.id} ${id}`).toBe(true)
      if (e.link) expect(staticPaths.has(e.link), `${e.id} ${e.link}`).toBe(true)
    }
  })

  it('gives at most four chips, all about the page itself, and only the Home page gets the stage\'s general ones', () => {
    const chips = chipsFor('H14', 'discover')
    expect(chips).toHaveLength(MAX_CHIPS)
    for (const c of chips) expect(c.screens).toContain('H14')
    expect(chipsFor('M17', 'remember')[0].screens).toContain('M17')
    expect(chipsFor(undefined, 'book')).toHaveLength(MAX_CHIPS)
    expect(chipsFor(undefined, 'book').every((e) => e.stages.includes('book'))).toBe(true)
    expect(chipsFor('none', 'book')).toEqual([])
  })

  it('answers a strong free-text match from the library and leaves a weak one for the model', () => {
    expect(matchQuestion('What does tender mean?', 'discover')?.id).toBe('discover.tender')
    expect(matchQuestion('what are gratuities', 'discover')?.id).toBe('discover.gratuities')
    expect(matchQuestion('is my progress saved if I stop', 'book')?.id).toBe('book.saved')
    expect(matchQuestion('What should I pack for the Caribbean?')).toBeNull()
    expect(matchQuestion('cabin')).toBeNull()
    expect(matchQuestion('')).toBeNull()
  })
})

describe('Stanley page questions', () => {
  // X07 is the one-time stage welcome, which is itself the guidance.
  const publicIds = ['X01', 'X02', 'X03', 'X04', 'X07']
  const pages = [...SCREEN_LIST.map((s) => s.id).filter((id) => !publicIds.includes(id)), ...ALL_TAB_KEYS.filter((k) => k !== 'home').map((k) => `tab.${k}`)]

  it('gives every page that shows the shell at least four questions of its own, except the Home front page, which has the stage\'s general ones', () => {
    expect(pages.filter((id) => PAGE_QA.filter((e) => e.screens.includes(id)).length < 4)).toEqual([])
    expect(PAGE_QA.some((e) => e.screens.includes('tab.home'))).toBe(false)
  })

  it('pairs every question with an answer, in his voice, and names only real pages', () => {
    const pages = new Set([...SCREEN_LIST.map((s) => s.id), ...ALL_TAB_KEYS.map((k) => `tab.${k}`)])
    expect(PAGE_QA.length).toBeGreaterThan(0)
    for (const e of PAGE_QA) {
      expect(pages.has(e.screens[0]!), e.id).toBe(true)
      const q = questionOf(e)
      const a = answerOf(e)
      expect(`stanley.a.${e.id}` in en, e.id).toBe(true)
      expect(q.length, e.id).toBeLessThanOrEqual(60)
      expect(q.endsWith('?'), e.id).toBe(true)
      expect(a.length, e.id).toBeLessThanOrEqual(260)
      expect(a, e.id).not.toMatch(/!/)
      if (e.link) expect(staticPaths.has(e.link), `${e.id} ${e.link}`).toBe(true)
    }
    const answers = Object.keys(en).filter((k) => k.startsWith('stanley.a.pg.'))
    expect(answers).toHaveLength(PAGE_QA.length)
  })

  it('offers related pages that exist, can be opened without an id, and are not the page itself', () => {
    for (const e of PAGE_QA) {
      for (const id of e.related ?? []) {
        const screen = SCREEN_BY_ID.get(id)
        expect(screen, `${e.id} ${id}`).toBeDefined()
        expect(screen!.path.includes(':'), `${e.id} ${id}`).toBe(false)
        expect(e.screens, `${e.id} ${id}`).not.toContain(id)
      }
      expect(new Set(e.related ?? []).size, e.id).toBe((e.related ?? []).length)
    }
    expect(PAGE_QA.filter((e) => !e.related?.length).map((e) => e.id)).toEqual([])
  })

  it('gives each answer enough words to be useful, to be useful', () => {
    expect(PAGE_QA.filter((e) => answerOf(e).length < 70).map((e) => e.id)).toEqual([])
  })

  it('does not repeat a question on one page, and keeps page ids apart from the general library', () => {
    const seen = new Set<string>()
    for (const e of PAGE_QA) {
      const key = `${e.screens[0]}|${questionOf(e)}`
      expect(seen.has(key), key).toBe(false)
      seen.add(key)
    }
    expect(PAGE_QA.some((e) => LIBRARY.includes(e))).toBe(false)
  })
})

describe('Quiet Stanley level', () => {
  it('is Helpful by default, and calm or simple mode caps it at Only when asked', () => {
    expect(stanleyLevelFor(DEFAULT_SETTINGS)).toBe('helpful')
    expect(stanleyLevelFor({ ...DEFAULT_SETTINGS, calm: true })).toBe('asked')
    expect(stanleyLevelFor({ ...DEFAULT_SETTINGS, simple: true, stanleyLevel: 'chatty' })).toBe('asked')
    expect(stanleyLevelFor({ ...DEFAULT_SETTINGS, calm: true, stanleyLevel: 'off' })).toBe('off')
  })
})
