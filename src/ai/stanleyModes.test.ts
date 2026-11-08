import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { SCREEN_LIST } from '../routes/screens'
import { dailyKey, dailyKind, lineKey, modeAutoShows, modeCanOpen, modeFor, modeSteps, modeView, timingOf, titleKey, MODE_IDS, type ModeFacts, type ModeId } from './stanleyModes'

const H = 3_600_000
const facts: Required<ModeFacts> = {
  boardingDay: { checkinDone: false },
  firstFour: { musterAt: 5 * H, musterDone: false, sailAwayAt: 7 * H },
  portDay: { allAboardAt: 16 * H, arriveAt: 8 * H, tender: true, skipped: false },
  seaDay: { events: [{ id: 'trivia', title: 'Team trivia', startAt: 10 * H, endAt: 11 * H, placeId: 'live' }, { id: 'cooking', title: 'Cooking demo', startAt: 11 * H, endAt: 12 * H, placeId: 'eclipse' }] },
  lastMorning: { tipBy: 20 * H, bagsOutAt: 22 * H, arrivalAt: 30 * H, vacateAt: 32 * H },
}
const staticPaths = new Set(SCREEN_LIST.map((s) => s.path).filter((p) => !p.includes(':')))

describe('which mode is on', () => {
  it('maps stages to modes and keeps each to its own day', () => {
    expect(modeFor({ stage: 'getToShip', daysToDeparture: 0, hour: 8, aboard: false })).toBe('boardingDay')
    expect(modeFor({ stage: 'getToShip', daysToDeparture: 2, hour: 8, aboard: false })).toBeNull()
    expect(modeFor({ stage: 'embark', hour: 14, aboard: true })).toBe('firstFour')
    expect(modeFor({ stage: 'embark', hour: 9, aboard: false })).toBeNull()
    expect(modeFor({ stage: 'port', hour: 9, aboard: true })).toBe('portDay')
    expect(modeFor({ stage: 'disembark', hour: 5, aboard: true })).toBe('lastMorning')
    expect(modeFor({ stage: 'sea', lastFullDay: false, hour: 10, aboard: true })).toBe('seaDay')
    expect(modeFor({ stage: 'sea', hour: 10, aboard: false })).toBeNull()
    expect(modeFor({ stage: 'dream', hour: 9, aboard: false })).toBeNull()
  })
  it('starts Last Morning on the evening of the last full day, not before', () => {
    expect(modeFor({ stage: 'sea', lastFullDay: true, hour: 17, aboard: true })).toBe('seaDay')
    expect(modeFor({ stage: 'sea', lastFullDay: true, hour: 18, aboard: true })).toBe('lastMorning')
    expect(modeFor({ stage: 'sea', lastFullDay: false, hour: 20, aboard: true })).toBe('seaDay')
  })
  it('starts by itself at Helpful and Chatty and opens by hand unless Stanley is Off', () => {
    expect(modeAutoShows('helpful') && modeAutoShows('chatty')).toBe(true)
    expect(modeAutoShows('asked') || modeAutoShows('off')).toBe(false)
    expect(modeCanOpen('asked')).toBe(true)
    expect(modeCanOpen('off')).toBe(false)
  })
})

describe('mode steps', () => {
  it('has steps for every mode and none without facts', () => {
    for (const m of MODE_IDS) {
      expect(modeSteps(m, facts).length, m).toBeGreaterThanOrEqual(m === 'seaDay' ? 2 : 5)
      expect(modeSteps(m, {}), m).toEqual([])
    }
  })
  it('has no steps for a skipped port', () => {
    expect(modeSteps('portDay', { portDay: { ...facts.portDay, skipped: true } })).toEqual([])
  })
  it('orders the port day by time and adds the last tender only on a tender day', () => {
    const tender = modeSteps('portDay', facts)
    const ats = tender.map((s) => s.at!)
    expect([...ats].sort((a, b) => a - b)).toEqual(ats)
    expect(tender.map((s) => s.id)).toContain('lastTender')
    expect(modeSteps('portDay', { portDay: { ...facts.portDay, tender: false } }).map((s) => s.id)).not.toContain('lastTender')
  })
  it('opens only real screens', () => {
    for (const m of MODE_IDS) for (const s of modeSteps(m, facts)) expect(staticPaths.has(s.to), `${m} ${s.id} ${s.to}`).toBe(true)
  })
  it('marks boarding steps done from the data', () => {
    const done = modeSteps('boardingDay', { boardingDay: { checkinDone: true } })[0]
    expect(done.done).toBe(true)
    const timed = modeSteps('boardingDay', { boardingDay: { checkinDone: false, leaveAt: 1000, terminalAt: 5000 } })
    expect(timed.find((s) => s.id === 'leave')!.at).toBe(1000)
    expect(timed.find((s) => s.id === 'gangway')!.at).toBe(5000)
    expect(modeSteps('boardingDay', { boardingDay: { checkinDone: false } }).every((s) => s.at === null)).toBe(true)
    expect(modeSteps('firstFour', { firstFour: { ...facts.firstFour, musterDone: true } }).find((s) => s.id === 'muster')!.done).toBe(true)
  })
})

describe('the sea day', () => {
  it('lists the planned events with where they are and the walk from the one before', () => {
    const steps = modeSteps('seaDay', facts)
    expect(steps.map((s) => s.label)).toEqual(['Team trivia', 'Cooking demo'])
    expect(steps[0].where).toMatch(/deck \d+/)
    expect(steps[0].walk).toBeUndefined()
    expect(steps[1].walk).toBeGreaterThan(0)
  })
  it('offers a free-day step when nothing is planned, and shows at most four events', () => {
    expect(modeSteps('seaDay', { seaDay: { events: [] } }).map((s) => s.id)).toEqual(['free'])
    const many = Array.from({ length: 7 }, (_, i) => ({ id: `e${i}`, title: 'x', startAt: i, endAt: i + 1, placeId: 'live' }))
    expect(modeSteps('seaDay', { seaDay: { events: many } })).toHaveLength(4)
  })
})

describe('the current step', () => {
  const steps = modeSteps('lastMorning', facts)
  it('is the first one not done, with what is before and after it', () => {
    const v = modeView(steps, new Set(['tips']), 19 * H)
    expect(v.current?.id).toBe('bags')
    expect(v.finished.map((s) => s.id)).toEqual(['tips'])
    expect(v.later.map((s) => s.id)).toEqual(['sweep', 'arrive', 'customs', 'vacate'])
    expect(v.minutesTo).toBe(180)
  })
  it('is null when everything is done, and a step with no time has no countdown', () => {
    expect(modeView(steps, new Set(steps.map((s) => s.id)), 0).current).toBeNull()
    expect(modeView(steps, new Set(['tips', 'bags']), 0).minutesTo).toBeNull()
  })
  it('reads timing: ahead, soon, past', () => {
    expect(timingOf(null)).toBe('none')
    expect(timingOf(120)).toBe('ahead')
    expect(timingOf(10)).toBe('soon')
    expect(timingOf(-1)).toBe('past')
  })
})

describe('the words', () => {
  const all: [ModeId, string, boolean][] = []
  for (const m of MODE_IDS) for (const s of modeSteps(m, facts)) all.push([m, s.id, s.at !== null])
  it('has a name, a finish, and a title and line for every step; a late line for every step with a time', () => {
    for (const m of MODE_IDS) {
      expect(`stanley.mode.${m}.name` in en, m).toBe(true)
      expect(`stanley.mode.${m}.finished` in en, m).toBe(true)
    }
    for (const [m, id, timed] of all) {
      const step = { id, at: timed ? 1 : null, to: '/' }
      if (m === 'seaDay') {
        const ev = { ...step, label: 'Trivia' }
        expect(lineKey(m, ev, 'ahead') in en && lineKey(m, ev, 'past') in en, 'seaDay event').toBe(true)
        continue
      }
      expect(titleKey(m, step) in en, `${m}.${id} title`).toBe(true)
      expect(lineKey(m, step, 'ahead') in en, `${m}.${id} line`).toBe(true)
      if (timed) expect(lineKey(m, step, 'past') in en, `${m}.${id} late`).toBe(true)
    }
  })
  it('keeps every line short and calm', () => {
    for (const [k, v] of Object.entries(en)) {
      if (!k.startsWith('stanley.mode.') && !k.startsWith('stanley.daily.')) continue
      expect(v.length, k).toBeLessThanOrEqual(190)
      expect(v, k).not.toMatch(/!/)
      expect(v, k).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
    }
  })
})

describe('the daily line', () => {
  it('picks the line for the day', () => {
    expect(dailyKind({ day: 1, of: 8, port: 'miami' })).toBe('firstDay')
    expect(dailyKind({ day: 8, of: 8, port: 'miami' })).toBe('lastDay')
    expect(dailyKind({ day: 3, of: 8, port: 'sea' })).toBe('sea')
    expect(dailyKind({ day: 4, of: 8, port: 'cozumel' })).toBe('port')
    expect(dailyKind({ day: 4, of: 8, port: 'cozumel', tender: true })).toBe('tender')
    for (const k of ['firstDay', 'port', 'tender', 'sea', 'lastDay'] as const) expect(dailyKey(k) in en).toBe(true)
  })
})
