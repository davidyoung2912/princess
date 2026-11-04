import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/locales/en'
import { SCREEN_BY_ID, SCREEN_LIST } from '../../routes/screens'
import { DEFAULT_SETTINGS, stanleyLevelFor } from '../../settings/settings'
import { LIBRARY, answerOf, chipsFor, matchQuestion, questionOf } from '.'

const staticPaths = new Set(SCREEN_LIST.map((s) => s.path).filter((p) => !p.includes(':')))

describe('Stanley library', () => {
  it('has 79 entries with unique ids across six stages', () => {
    expect(LIBRARY).toHaveLength(79)
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(79)
    for (const stage of ['dream', 'discover', 'book', 'manage', 'prebook', 'getToShip'] as const) expect(LIBRARY.filter((e) => e.stages.includes(stage)).length).toBeGreaterThanOrEqual(13)
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

  it('gives at most three chips, the screen\'s own first, and none for a stage with no library', () => {
    const chips = chipsFor('H14', 'discover')
    expect(chips).toHaveLength(3)
    expect(chips[0].screens).toContain('H14')
    expect(chipsFor('H14', 'port')).toEqual([])
    expect(chipsFor(undefined, 'book')).toHaveLength(3)
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

describe('Quiet Stanley level', () => {
  it('is Helpful by default, and calm or simple mode caps it at Only when asked', () => {
    expect(stanleyLevelFor(DEFAULT_SETTINGS)).toBe('helpful')
    expect(stanleyLevelFor({ ...DEFAULT_SETTINGS, calm: true })).toBe('asked')
    expect(stanleyLevelFor({ ...DEFAULT_SETTINGS, simple: true, stanleyLevel: 'chatty' })).toBe('asked')
    expect(stanleyLevelFor({ ...DEFAULT_SETTINGS, calm: true, stanleyLevel: 'off' })).toBe('off')
  })
})
