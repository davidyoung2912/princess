import { describe, expect, it } from 'vitest'
import { addCaregiver, CAREGIVER_NEVER, EMPTY_CALM, EMPTY_PROFILE, kitStatus, LOUD_MOMENTS, normalizeCalm, requestKit, sensoryPlan, STORY, visualSchedule } from './calm'
import { EVENTS } from './program'
import { applyChanges, type PlanEntry } from './planChange'
import type { PulseEnv } from './pulse'

const MIN = 60_000
const env: PulseEnv = { hour: (at) => ((at / MIN) % 1440) / 60, served: (_id, at) => (((at / MIN) % 1440) / 60 >= 19 ? 80 : 20) }
const e = (id: string, start: string, minutes = 60, extra: Partial<PlanEntry> = {}): PlanEntry => ({ id, title: id, start, minutes, kind: 'event', outdoor: false, path: '/plan', ...extra })
const accepted = (edits: never[] | { op: 'drop' | 'move'; id: string; to?: string }[]) => ({ id: 'c', day: 2, source: 'autopilot' as const, cause: '', title: '', why: '', edits: edits as never, status: 'accepted' as const, proposedAt: 0, undoUntil: 9 })

describe('sensory plan', () => {
  const rows = applyChanges([e('sailaway', '15:00'), e('dome-dj', '23:00'), e('trivia', '10:30')], [])

  it('warns about loud moments only for a guest who asked for low noise', () => {
    expect(sensoryPlan(EMPTY_PROFILE, rows, 0, 0, env).warnings).toEqual([])
    const plan = sensoryPlan({ ...EMPTY_PROFILE, noise: 'low' }, rows, 0, 0, env)
    expect(plan.warnings.map((w) => w.id)).toEqual(['sailaway', 'dome-dj'])
    expect(plan.warnings[0].text).toContain('horn')
    expect(plan.quietLane).toBe(true)
  })

  it('adds a light warning for flashing lights and ignores dropped items', () => {
    const plan = sensoryPlan({ ...EMPTY_PROFILE, light: 'low' }, rows, 0, 0, env)
    expect(plan.warnings.map((w) => [w.id, w.kind])).toEqual([['dome-dj', 'light']])
    const dropped = applyChanges([e('dome-dj', '23:00')], [accepted([{ op: 'drop', id: 'dome-dj' }])])
    expect(sensoryPlan(EMPTY_PROFILE, dropped, 0, 0, env).warnings).toEqual([])
    expect(sensoryPlan({ ...EMPTY_PROFILE, noise: 'low' }, dropped, 0, 0, env).warnings).toEqual([])
  })

  it('flags a busy venue for a guest who wants fewer crowds', () => {
    const plan = sensoryPlan({ ...EMPTY_PROFILE, crowd: 'low' }, applyChanges([e('show', '20:30', 60, { placeId: 'arena' })], []), 0, 0, env)
    expect(plan.warnings.some((w) => w.kind === 'crowd')).toBe(true)
  })

  it('names up to three quiet windows in time order, and calm spaces', () => {
    const plan = sensoryPlan(EMPTY_PROFILE, rows, 0, 12 * 60 * MIN, env)
    expect(plan.quietWindows).toHaveLength(3)
    expect([...plan.quietWindows].sort((a, b) => a.start.localeCompare(b.start))).toEqual(plan.quietWindows)
    expect(plan.spaces.every((s) => s.noise <= 2)).toBe(true)
  })

  it('only names real events as loud', () => {
    for (const id of Object.keys(LOUD_MOMENTS)) expect(EVENTS.some((x) => x.id === id), id).toBe(true)
  })
})

describe('social story and visual schedule', () => {
  it('has plain steps that each say what is heard and what to do', () => {
    expect(STORY.length).toBeGreaterThanOrEqual(6)
    for (const s of STORY) for (const v of [s.title, s.happens, s.sounds, s.yourPart]) expect(v.length).toBeGreaterThan(5)
    expect(new Set(STORY.map((s) => s.id)).size).toBe(STORY.length)
  })

  const rows = applyChanges([e('a', '09:00'), e('b', '11:00'), e('c', '13:00'), e('d', '15:00')], [accepted([{ op: 'move', id: 'c', to: '13:30' }])])

  it('shows now, next and later, with the change named', () => {
    const cards = visualSchedule(rows, '09:30')
    expect(cards.map((c) => [c.kind, c.id])).toEqual([['now', 'a'], ['next', 'b'], ['later', 'c'], ['later', 'd']])
    expect(cards[2].changed).toBe('Moved from 13:00')
    expect(cards[0].changed).toBeNull()
  })

  it('starts with next when nothing is under way and is empty at the end of the day', () => {
    expect(visualSchedule(rows, '10:30')[0].kind).toBe('next')
    expect(visualSchedule(rows, '23:00')).toEqual([])
  })
})

describe('kit request and caregiver', () => {
  it('needs at least one item and confirms later in the simulation', () => {
    expect(requestKit([], 0)).toBeNull()
    const r = requestKit(['lanyard', 'headphones', 'lanyard'], 100)!
    expect(r.items).toEqual(['headphones', 'lanyard'])
    expect(kitStatus(r, 100 + 59 * MIN)).toBe('requested')
    expect(kitStatus(r, 100 + 60 * MIN)).toBe('confirmed')
  })

  it('needs a name and the guest’s consent, and never shows where the guest is', () => {
    expect(addCaregiver(' ', 'guest', true, 0)).toEqual({ ok: false, problem: 'name' })
    expect(addCaregiver('Sam', 'guest', false, 0)).toEqual({ ok: false, problem: 'consent' })
    const ok = addCaregiver(' Sam ', 'legal', true, 5)
    expect(ok.ok && ok.caregiver).toEqual({ name: 'Sam', authority: 'legal', consentedAt: 5 })
    expect(CAREGIVER_NEVER.join(' ')).toContain('where the guest is')
  })

  it('reads stored state safely', () => {
    expect(normalizeCalm(null)).toEqual(EMPTY_CALM)
    const n = normalizeCalm({ profile: { noise: 'low', light: 'x' }, kit: { items: ['fidget', 'bad'], requestedAt: 1 }, caregiver: { name: 'Sam', consentedAt: 2 }, cognitive: true, storyDone: ['cabin', 'nope'] })
    expect(n.profile).toEqual({ noise: 'low', light: 'any', crowd: 'any', touch: 'any' })
    expect(n.kit?.items).toEqual(['fidget'])
    expect(n.caregiver?.authority).toBe('guest')
    expect(n.cognitive).toBe(true)
    expect(n.storyDone).toEqual(['cabin'])
    expect(normalizeCalm({ caregiver: { name: '', consentedAt: 1 } }).caregiver).toBeNull()
  })
})
