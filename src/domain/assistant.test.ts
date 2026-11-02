import { describe, expect, it } from 'vitest'
import { ask, EXAMPLES, type Facts } from './assistant'
import { applyChanges, type PlanEntry } from './planChange'

const e = (id: string, start: string, kind: PlanEntry['kind'] = 'event'): PlanEntry => ({ id, title: id, start, minutes: 60, kind, outdoor: false, path: '/plan' })
const facts = (extra: Partial<Facts> = {}): Facts => ({
  nowHhmm: '12:00',
  plan: applyChanges([e('trivia', '10:30'), e('bingo', '14:00'), e('dinner', '18:30', 'dinner')], []),
  todo: [{ label: 'Upload your passport', path: '/me/documents' }],
  charges: [{ label: 'Gratuities, day 3', cents: 1800, reason: 'A daily amount shared with the crew.' }],
  allAboard: '16:30',
  ...extra,
})

describe('ask your cruise', () => {
  it('answers dinner from the plan, with where it came from', () => {
    const a = ask('What time is dinner?', facts())
    expect(a.text).toContain('18:30')
    expect(a.known).toBe(true)
    expect(a.sources.length).toBeGreaterThan(0)
  })

  it('says so when there is no dinner, and does not skip a dropped one', () => {
    const a = ask('what time is dinner', facts({ plan: applyChanges([e('dinner', '18:30', 'dinner')], [{ id: 'c', day: 2, source: 'autopilot', cause: '', title: '', why: '', edits: [{ op: 'drop', id: 'dinner' }], status: 'accepted', proposedAt: 0, undoUntil: 1 }]) }))
    expect(a.text).toContain('no dinner')
  })

  it('finds what is next after now', () => {
    expect(ask("what's next", facts()).text).toContain('bingo')
    expect(ask('what is next', facts({ nowHhmm: '23:00' })).text).toContain('Nothing else')
  })

  it('lists what is left to do, or says nothing is', () => {
    expect(ask('What do I still need to do?', facts()).text).toContain('Upload your passport')
    expect(ask('what do i still need to do', facts({ todo: [] })).text).toBe('Nothing is waiting for you.')
  })

  it('explains a charge by its amount and admits when it cannot find it', () => {
    const a = ask('Why was I charged $18?', facts())
    expect(a.text).toContain('Gratuities')
    expect(a.sources[0].path).toBe('/me/bill')
    const none = ask('Why was I charged $99?', facts())
    expect(none.known).toBe(false)
    expect(none.text).toContain('$99')
  })

  it('gives the all-aboard time, or says the ship is not in port', () => {
    expect(ask('When must I be back on the ship?', facts()).text).toContain('16:30')
    expect(ask('when is all aboard', facts({ allAboard: null })).text).toContain('not in a port')
  })

  it('says it cannot see a list that has not loaded, rather than saying it is empty', () => {
    const a = ask('What do I still need to do?', facts({ todo: null }))
    expect(a.known).toBe(false)
    expect(a.text).toContain('cannot see your checklist')
    expect(ask('Why was I charged $18?', facts({ charges: null })).text).toContain('cannot see your bill')
  })

  it('does not guess about anything else', () => {
    const a = ask('Is the ocean warm in Roatán?', facts())
    expect(a.known).toBe(false)
    expect(a.sources).toEqual([])
    expect(a.text).toContain('I do not know')
  })

  it('answers every example question it suggests', () => {
    for (const q of EXAMPLES) expect(ask(q, facts()).known, q).toBe(true)
  })
})
