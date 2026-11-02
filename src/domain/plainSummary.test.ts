import { describe, expect, it } from 'vitest'
import { LEGAL } from './policy'
import { applyChanges, type Change, type PlanEntry } from './planChange'
import { SUMMARY_LEVELS, sentences, summariseBill, summariseNotice, summarisePlan, summaryText, unsupportedNumbers } from './plainSummary'

const e = (id: string, start: string, kind: PlanEntry['kind'] = 'event'): PlanEntry => ({ id, title: id, start, minutes: 60, kind, outdoor: false, path: '/plan' })
const change = (edits: Change['edits']): Change => ({ id: 'c1', day: 1, source: 'assistant', cause: 'test', title: 't', why: 'w', edits, status: 'accepted', proposedAt: 0, undoUntil: 0 })
const rows = applyChanges([e('trivia', '10:30'), e('chops', '18:30', 'dinner'), e('bingo', '14:00')], [])
const charges = [
  { label: 'Gratuities, day 3', cents: 1800, reason: 'A daily amount shared with the crew.' },
  { label: 'Wi-Fi', cents: 4500, reason: 'A Wi-Fi plan you added.' },
  { label: 'Credit', cents: -500, reason: 'A credit.' },
]

describe('plain-English summaries', () => {
  it('summarises the day in time order, at every level, and always carries the original', () => {
    for (const level of SUMMARY_LEVELS) {
      const s = summarisePlan(rows, level)
      expect(s.original).toHaveLength(3)
      expect(s.original[0]).toMatch(/^10:30 trivia/)
      expect(s.source.path).toBe('/plan/day')
      expect(unsupportedNumbers(s)).toEqual([])
    }
    expect(summarisePlan(rows, 'short').lines.join(' ')).toMatch(/3 things.*trivia at 10:30.*Dinner is at 18:30/)
    expect(summarisePlan(rows, 'plain').lines[2]).toBe('At 18:30: chops.')
    expect(summarisePlan([], 'short').lines[0]).toMatch(/Nothing is planned/)
  })

  it('leaves out a dropped item and names where a moved one was', () => {
    const moved = applyChanges([e('trivia', '10:30')], [change([{ op: 'move', id: 'trivia', to: '11:30' }])])
    expect(summarisePlan(moved, 'steps').lines[0]).toMatch(/at 11:30.*moved it from 10:30/)
    const dropped = applyChanges([e('trivia', '10:30'), e('bingo', '14:00')], [change([{ op: 'drop', id: 'bingo' }])])
    expect(summarisePlan(dropped, 'plain').lines).toEqual(['At 10:30: trivia.'])
  })

  it('summarises the bill with only the amounts that are on it', () => {
    const short = summariseBill(charges, 'short')
    expect(short.lines[0]).toBe('2 charges, $63 in all.')
    expect(short.lines[1]).toMatch(/Wi-Fi: \$45/)
    const steps = summariseBill(charges, 'steps')
    expect(steps.lines[0]).toMatch(/^Wi-Fi is \$45/)
    expect(steps.lines.at(-1)).toBe('Add them up: $63.')
    expect(summariseBill(charges, 'plain').lines.join(' ')).not.toMatch(/Credit/)
    for (const level of SUMMARY_LEVELS) expect(unsupportedNumbers(summariseBill(charges, level), [`${charges[0].reason}`, '$63'])).toEqual([])
    expect(summariseBill([], 'short').lines[0]).toMatch(/no charges/)
  })

  it('shortens a notice without rewording it: every line is a sentence of the original', () => {
    for (const doc of LEGAL) {
      const original = doc.body.flatMap(sentences)
      for (const level of SUMMARY_LEVELS) {
        const s = summariseNotice(doc.title, '/me/legal', doc.body, level)
        expect(s.original).toEqual([...doc.body])
        expect(s.lines.length).toBeGreaterThan(0)
        for (const l of s.lines) expect(original).toContain(l)
      }
      expect(summariseNotice(doc.title, '/x', doc.body, 'short').lines.length).toBeLessThanOrEqual(original.length)
      expect(summariseNotice(doc.title, '/x', doc.body, 'plain').lines).toEqual(original)
    }
    const preg = summariseNotice('P', '/x', LEGAL.find((l) => l.id === 'pregnancy')!.body, 'short')
    expect(preg.lines.join(' ')).toMatch(/24 weeks/)
  })

  it('catches a number that is not in the original, and numbers the steps in text', () => {
    const s = { ...summarisePlan(rows, 'plain'), lines: ['At 09:15: trivia.'] }
    expect(unsupportedNumbers(s)).toEqual(['09:15'])
    expect(summaryText(summarisePlan(rows, 'plain'), 'Day', true)).toMatch(/Day\n1\. At 10:30/)
  })
})
