import { describe, expect, it } from 'vitest'
import { lastReceipt, normalizeActivity, undoOpen } from './stanleyActivity'

const r = (over: Record<string, unknown> = {}) => ({
  id: 'a1', number: 'STN-AB12CD34', kind: 'reserve_dinner', status: 'done', at: '2027-03-01T12:00:00Z', what: 'Booked a table', why: 'You asked me to, and you said yes.',
  facts: 'Checked again when you said yes.', affects: 'Only you.', undo: 'Cancel the table.', undoUntil: '2027-03-01T14:00:00Z', canUndo: true, stop: 'Nothing to switch off.', ...over,
})
const body = (did: unknown[] = [r()]) => ({ paused: false, did, watching: [{ id: 'CL-02', wording: 'Tell me', example: 'e', never: 'n' }], remembers: { enabled: true, count: 1, items: [{ id: 'm1', text: 'You like a relaxed pace', reason: 'You told me' }] } })

describe('normalizeActivity', () => {
  it('reads a full reply', () => {
    const a = normalizeActivity(body())
    expect(a?.did).toHaveLength(1)
    expect(a?.undoableNow).toBe(1)
    expect(a?.watching[0]?.id).toBe('CL-02')
    expect(a?.remembers.items[0]?.text).toBe('You like a relaxed pace')
  })
  it('drops a receipt missing any of its six fields or with an unknown status', () => {
    for (const f of ['what', 'why', 'facts', 'affects', 'undo', 'stop']) expect(normalizeActivity(body([r({ [f]: '' })]))?.did).toHaveLength(0)
    expect(normalizeActivity(body([r({ status: 'prepared' })]))?.did).toHaveLength(0)
  })
  it('refuses a reply that is not the agreed shape', () => {
    expect(normalizeActivity(null)).toBeNull()
    expect(normalizeActivity({ did: [] })).toBeNull()
  })
})

describe('helpers', () => {
  it('finds the last thing he did, skipping failures', () => {
    const a = normalizeActivity(body([r({ id: 'f', status: 'failed' }), r({ id: 'd' })]))
    expect(a && lastReceipt(a)?.id).toBe('d')
  })
  it('stops offering undo once the window has closed on this clock', () => {
    const a = normalizeActivity(body())?.did[0]
    expect(a && undoOpen(a, Date.parse('2027-03-01T13:59:00Z'))).toBe(true)
    expect(a && undoOpen(a, Date.parse('2027-03-01T14:01:00Z'))).toBe(false)
  })
})
