import { beforeEach, describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { SCREEN_BY_ID } from '../routes/screens'
import { COACH_SCREENS, COACH_STEPS, MOMENTS, coachAutoShows, coachCanReplay, hasCoach, momentKey, momentsShow } from './stanleyMoments'

describe('Stanley moments', () => {
  it('has a title, a line and a way on for each, with exclamation marks only in titles', () => {
    for (const m of MOMENTS) {
      for (const part of ['title', 'line', 'go'] as const) expect(`stanley.moment.${m.id}.${part}` in en, `${m.id} ${part}`).toBe(true)
      expect(en[`stanley.moment.${m.id}.line` as keyof typeof en], m.id).not.toMatch(/!/)
      expect((en[`stanley.moment.${m.id}.line` as keyof typeof en] as string).length).toBeLessThanOrEqual(160)
    }
  })

  it('shows at Helpful and Chatty only', () => {
    expect(momentsShow('chatty')).toBe(true)
    expect(momentsShow('helpful')).toBe(true)
    expect(momentsShow('asked')).toBe(false)
    expect(momentsShow('off')).toBe(false)
  })

  it('plays once per thing', () => {
    expect(momentKey('booked', 'PR1')).not.toBe(momentKey('booked', 'PR2'))
    expect(momentKey('booked', 'PR1')).not.toBe(momentKey('checkedIn', 'PR1'))
  })
})

describe('Stanley coach', () => {
  it('covers five real screens with words for every step', () => {
    expect(COACH_SCREENS).toHaveLength(5)
    for (const id of COACH_SCREENS) {
      expect(SCREEN_BY_ID.has(id), id).toBe(true)
      expect(COACH_STEPS[id]).toBeGreaterThanOrEqual(2)
      expect(COACH_STEPS[id]).toBeLessThanOrEqual(3)
      for (let n = 1; n <= COACH_STEPS[id]; n++) {
        for (const part of ['title', 'body'] as const) {
          const text = en[`stanley.coach.${id}.${n}.${part}` as keyof typeof en] as string
          expect(text, `${id} ${n} ${part}`).toBeTruthy()
          expect(text, `${id} ${n} ${part}`).not.toMatch(/!/)
        }
      }
      expect(`stanley.coach.${id}.${COACH_STEPS[id] + 1}.title` in en).toBe(false)
    }
    expect(hasCoach('S01')).toBe(true)
    expect(hasCoach('H02')).toBe(false)
    expect(hasCoach(undefined)).toBe(false)
  })

  it('starts by itself only at Chatty and can be replayed unless Off', () => {
    expect(coachAutoShows('chatty')).toBe(true)
    expect(coachAutoShows('helpful')).toBe(false)
    expect(coachCanReplay('asked')).toBe(true)
    expect(coachCanReplay('off')).toBe(false)
  })
})

describe('seen store', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) }
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  })

  it('remembers a dismissal, ends a replay, and resets', async () => {
    const { isSeen, markSeen, requestReplay, isReplayed, resetSeen } = await import('../settings/stanleySeen')
    resetSeen()
    expect(isSeen('coach:S01')).toBe(false)
    requestReplay('coach:S01')
    expect(isReplayed('coach:S01')).toBe(true)
    markSeen('coach:S01')
    expect(isSeen('coach:S01')).toBe(true)
    expect(isReplayed('coach:S01')).toBe(false)
    resetSeen()
    expect(isSeen('coach:S01')).toBe(false)
  })
})
