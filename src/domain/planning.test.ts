import { describe, expect, it } from 'vitest'
import { EMPTY_ACCESS } from './bookingPrep'
import { DEFAULT_PREFS } from './autopilot'
import { EXCURSIONS, excursionById } from './excursions'
import { REFERENCE_SAILING } from './sailings'
import { fixtureWeek } from './weekFixture'
import { addIdea, addTradition, applyWeek, briefFor, budgetNote, carryOver, castVote, compareExcursion, difficultyConcerns, DIFFICULTY, heartIdea, leader, newPoll, normalizePlanning, rhythmPrefs, sharedDay, tasteInferences, tally, withoutSurprises } from './planning'

describe('planning', () => {
  it('has difficulty for every excursion and flags steps for someone who uses a walker', () => {
    for (const x of EXCURSIONS) expect(DIFFICULTY[x.id]).toBeDefined()
    expect(difficultyConcerns(excursionById('coz-ruins')!, EMPTY_ACCESS)).toEqual([])
    const c = difficultyConcerns(excursionById('coz-ruins')!, { ...EMPTY_ACCESS, mobility: true, device: 'walker' })
    expect(c).toContain('steps')
    expect(difficultyConcerns(excursionById('coz-snorkel')!, { ...EMPTY_ACCESS, device: 'wheelchair' })).toContain('wheelchair')
  })
  it('compares ship and independent with the late rule as the difference', () => {
    const c = compareExcursion(excursionById('coz-snorkel')!)
    expect(c.ship.ifLate).toBe('shipWaits')
    expect(c.independent.ifLate).toBe('shipLeaves')
    expect(c.saving).toBeGreaterThan(0)
  })
  it('runs a poll with one vote each and no winner on a tie', () => {
    let p = newPoll('p', 'Where to eat?', ['Pizza', 'Tacos', 'Pizza'])!
    expect(p.options).toHaveLength(2)
    expect(newPoll('p', '', ['a', 'b'])).toBeNull()
    expect(newPoll('p', 'q', ['only'])).toBeNull()
    p = castVote(p, 'Ann', 'o1'); p = castVote(p, 'Bo', 'o2')
    expect(leader(p)).toBeNull()
    p = castVote(p, 'Bo', 'o1')
    expect(leader(p)?.label).toBe('Pizza')
    expect(tally(p).map((x) => x.votes)).toEqual([2, 0])
    expect(castVote(p, 'Cy', 'nope')).toBe(p)
  })
  it('hearts toggle on the dream board', () => {
    let i = addIdea([], 'a', ' Swim with rays ')
    i = heartIdea(i, 'a', 'Ann'); i = heartIdea(i, 'a', 'Bo'); i = heartIdea(i, 'a', 'Ann')
    expect(i[0].hearts).toEqual(['Bo'])
  })
  it('keeps surprises out of anything shared', () => {
    const items = [{ id: 'a', title: 'Spa day' }, { id: 'b', title: 'Cake at dinner' }, { id: 'c', title: 'Show' }]
    expect(withoutSurprises(items, [{ id: 'x', text: 'cake at dinner' }, { id: 'c', text: 'x' }]).map((i) => i.id)).toEqual(['a'])
  })
  it('lists every inference with a source, and honours remove and global off', () => {
    const input = { fit: ['quiet' as const], pasted: [{ day: null, text: 'Snorkel the reef' }], pace: 'balanced' as const, rhythm: null }
    const all = tasteInferences(input, false, [])
    expect(all.map((i) => i.source)).toEqual(['quiz', 'pasted', 'pace'])
    expect(tasteInferences(input, false, [all[0].id])).toHaveLength(2)
    expect(tasteInferences(input, true, [])).toEqual([])
  })
  it('notes at 80 and over 100 percent', () => {
    expect(budgetNote(50, null)).toBeNull()
    expect(budgetNote(50, 100)?.level).toBe('ok')
    expect(budgetNote(80, 100)?.level).toBe(80)
    expect(budgetNote(120, 100)).toMatchObject({ level: 100, over: 20 })
  })
  it('sends the child brief only to the right club and drops empty fields', () => {
    expect(briefFor({ name: 'Mia', age: null, allergies: '', comfort: '', bedtime: '', needs: '' })).toBeNull()
    const small = briefFor({ name: 'Mia', age: 5, allergies: 'nuts', comfort: 'bear', bedtime: '8pm', needs: '' })!
    expect(small.club).toBe('firefly')
    expect(small.fields.map((f) => f.field)).toEqual(['name', 'allergies', 'comfort', 'bedtime'])
    const teen = briefFor({ name: 'Al', age: 15, allergies: 'nuts', comfort: 'bear', bedtime: '8pm', needs: 'quiet' })!
    expect(teen.club).toBe('underground')
    expect(teen.fields.map((f) => f.field)).toEqual(['name', 'allergies', 'needs'])
  })
  it('turns a late riser into no early starts and a napper into a relaxed pace', () => {
    expect(rhythmPrefs({ wake: 'late', nap: true, lateMeals: false })).toEqual({ noEarly: true, pace: 'relaxed' })
    expect(rhythmPrefs({ wake: 'early', nap: false, lateMeals: false })).toEqual({ noEarly: false })
  })
  it('carries traditions into the next trip with boxes clear', () => {
    const l = addTradition([], 'a', 'Ice cream on day 1')
    expect(carryOver([{ ...l[0], done: true }])[0].done).toBe(false)
  })
  it('shows what cabins do together and apart', () => {
    const r = sharedDay([{ id: 'a', name: 'Cabin 1', tourIds: ['coz-snorkel', 'coz-ruins'] }, { id: 'b', name: 'Cabin 2', tourIds: ['coz-snorkel'] }])
    expect(r.together).toEqual(['Reef snorkel by boat'])
    expect(r.apart[0].titles).toEqual(['San Gervasio Mayan ruins'])
    expect(sharedDay([{ id: 'a', name: 'Solo', tourIds: ['coz-ruins'] }]).together).toEqual([])
  })
  it('applies a relaxed week as accepted, undoable changes and does not repeat', () => {
    const prefs = { ...DEFAULT_PREFS, pace: 'relaxed' as const, noEarly: true }
    const week = fixtureWeek(REFERENCE_SAILING, prefs)
    const r = applyWeek(REFERENCE_SAILING, week, [], 1_000)
    expect(r.applied).toBeGreaterThan(0)
    expect(r.changes.every((c) => c.status === 'accepted' && c.undoUntil > 1_000)).toBe(true)
    expect(applyWeek(REFERENCE_SAILING, week, r.changes, 2_000).applied).toBe(0)
  })
  it('normalises junk to the empty state', () => {
    const s = normalizePlanning({ polls: [{ id: 'x' }], privacy: { medical: true, plans: true }, rhythm: { wake: 'never' } })
    expect(s.polls).toEqual([])
    expect(s.privacy).toEqual({ plans: true, spending: false, photos: false, medical: false })
    expect(s.rhythm).toBeNull()
  })
})
