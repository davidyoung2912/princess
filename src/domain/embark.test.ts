import { describe, expect, it } from 'vitest'
import {
  EMPTY_EMBARK, EMPTY_FAMILY, EMPTY_NEEDS, EMPTY_WELCOME, familyProblems, firstHours, normalizeEmbark, setReady, setRole, sharedWelcome,
  stewardFor, swapEffect,
} from './embark'
import { WELCOME_FIELDS } from './embark'
import { en } from '../i18n/en'

describe('swapping arrival windows', () => {
  it('shows the consequence of swapping windows from the server’s waits', () => {
    const quiet = { start: '11:00', waitMinutes: 10 }
    const busiest = { start: '12:00', waitMinutes: 40 }
    const fx = swapEffect(quiet, busiest)
    expect(fx.waitChange).toBe(30)
    expect(fx.aboardChange).toBe(90)
    expect(swapEffect(quiet, quiet).sameSlot).toBe(true)
    expect(swapEffect(busiest, quiet).aboardChange).toBe(-90)
  })
})

describe('first three hours', () => {
  it('puts lunch before the cabin when it is not ready', () => {
    const r = firstHours('11:30')
    expect(r.cabinReady).toBe(false)
    expect(r.items.map((i) => i.id)).toEqual(['lunch', 'cabin', 'muster', 'bags', 'sailAway'])
  })
  it('goes to the cabin first when it is ready', () => {
    const r = firstHours('13:10')
    expect(r.cabinReady).toBe(true)
    expect(r.items[0].id).toBe('cabin')
  })
  it('keeps the items in time order and bags after the cabin opens', () => {
    for (const t of ['10:30', '12:00', '13:00', '14:00']) {
      const r = firstHours(t)
      expect(r.items.map((i) => i.at)).toEqual([...r.items.map((i) => i.at)].sort((a, b) => a - b))
      expect(r.bagsAt).toBeGreaterThanOrEqual(14 * 60)
    }
  })
  it('falls back on a bad time', () => {
    expect(firstHours('nonsense').items.length).toBe(5)
  })
})

describe('family plan', () => {
  const people = [{ id: 'a', child: false }, { id: 'b', child: false }, { id: 'c', child: true }]
  it('is quiet when everyone boards together', () => {
    expect(familyProblems(people, EMPTY_FAMILY)).toEqual([])
  })
  it('flags children sent ahead alone or left to park', () => {
    expect(familyProblems(people, setRole(EMPTY_FAMILY, 'c', 'ahead'))).toEqual(['childAlone'])
    expect(familyProblems(people, setRole(setRole(EMPTY_FAMILY, 'c', 'ahead'), 'a', 'ahead'))).toEqual([])
    expect(familyProblems(people, setRole(EMPTY_FAMILY, 'c', 'park'))).toEqual(['parkerWithChild'])
  })
  it('records readiness without touching roles', () => {
    expect(setReady(EMPTY_FAMILY, 'a', true).ready).toEqual({ a: true })
  })
})

describe('welcome', () => {
  it('shares nothing until a field is ticked', () => {
    expect(sharedWelcome({ ...EMPTY_WELCOME, occasion: 'Anniversary' })).toEqual([])
  })
  it('shares only ticked fields that have text', () => {
    expect(sharedWelcome({ ...EMPTY_WELCOME, share: ['occasion', 'dietary'], occasion: ' Anniversary ', dietary: '' })).toEqual([{ field: 'occasion', text: 'Anniversary' }])
  })
  it('uses no selling words', () => {
    const text = Object.entries(en).filter(([k]) => k.startsWith('welcome.')).map(([, v]) => v).join(' ')
    expect(text).not.toMatch(/\b(offer|upgrade|buy|discount|sale|book now|package)\b/i)
    expect(WELCOME_FIELDS.length).toBe(3)
  })
})

describe('steward and stored state', () => {
  it('names the same steward for the same booking', () => {
    expect(stewardFor('x')).toBe(stewardFor('x'))
  })
  it('repairs bad stored data', () => {
    expect(normalizeEmbark(5)).toEqual(EMPTY_EMBARK)
    const n = normalizeEmbark({ needs: { travelMinutes: 1, earliest: '25:00', priority: 'yes' }, window: 'x', family: { roles: { a: 'ahead', b: 'fly' }, meetNote: 'x'.repeat(200) }, welcome: { share: ['dietary', 'nope'], occasion: 'y'.repeat(99) } })
    expect(n.needs.travelMinutes).toBe(EMPTY_NEEDS.travelMinutes)
    expect(n.needs.earliest).toBeNull()
    expect(n.needs.priority).toBe(false)
    expect(n.family.roles).toEqual({ a: 'ahead' })
    expect(n.family.meetNote.length).toBe(80)
    expect(n.welcome.share).toEqual(['dietary'])
    expect(n.welcome.occasion.length).toBe(40)
  })
})
