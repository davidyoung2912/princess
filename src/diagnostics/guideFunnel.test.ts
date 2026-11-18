import { describe, expect, it } from 'vitest'
import { guide, task } from '../guide/fixture'
import { FUNNEL_KEY, clearFunnel, funnelByStage, markTask, noteGuide, readFunnel } from './guideFunnel'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

describe('the plan funnel on this device', () => {
  it('notes the tasks Home lists as seen, and finished ones as seen and done', () => {
    const s = memory()
    noteGuide(s, guide('manage', [task('manage.pay'), task('manage.phone'), task('manage.documents', { state: 'done' })]))
    expect(readFunnel(s)).toEqual({
      'manage.pay': { seen: true, done: false, skipped: false },
      'manage.phone': { seen: true, done: false, skipped: false },
      'manage.documents': { seen: true, done: true, skipped: false },
    })
  })

  it('keeps marks when a task later finishes, and does not count a carried-over task as done in its new stage', () => {
    const s = memory()
    noteGuide(s, guide('manage', [task('manage.pay')]))
    noteGuide(s, guide('prebook', [task('manage.pay', { state: 'done', carriedFrom: 'manage' })]))
    expect(readFunnel(s)['manage.pay']).toEqual({ seen: true, done: false, skipped: false })
    noteGuide(s, guide('manage', [task('manage.pay', { state: 'done' })]))
    expect(readFunnel(s)['manage.pay']).toEqual({ seen: true, done: true, skipped: false })
  })

  it('marks a task put aside, and groups the totals by stage in journey order', () => {
    const s = memory()
    noteGuide(s, guide('prebook', [task('prebook.clubs'), task('prebook.dining')]))
    markTask(s, 'prebook.clubs', 'skipped')
    noteGuide(s, guide('dream', [task('dream.quiz', { state: 'done' })]))
    expect(funnelByStage(readFunnel(s))).toEqual([
      { stage: 'dream', seen: 1, done: 1, skipped: 0 },
      { stage: 'prebook', seen: 2, done: 0, skipped: 1 },
    ])
  })

  it('keeps only task ids and three yes-or-no marks, and ignores anything else in storage', () => {
    const s = memory()
    s.setItem(FUNNEL_KEY, JSON.stringify({ 'sea.today': { seen: true, note: 'private', done: 3 }, 'free text here': { seen: true }, 'sea.dinner': 5 }))
    expect(readFunnel(s)).toEqual({ 'sea.today': { seen: true, done: false, skipped: false } })
    markTask(s, 'not a task', 'seen')
    expect(Object.keys(readFunnel(s))).toEqual(['sea.today'])
    s.setItem(FUNNEL_KEY, '{broken')
    expect(readFunnel(s)).toEqual({})
  })

  it('clears, and never throws on a blocked or missing store', () => {
    const s = memory()
    markTask(s, 'sea.today', 'seen')
    clearFunnel(s)
    expect(readFunnel(s)).toEqual({})
    const blocked = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') }, removeItem: () => { throw new Error('no') } }
    expect(() => { markTask(blocked, 'sea.today', 'seen'); noteGuide(blocked, guide('sea', [task('sea.today')])); clearFunnel(blocked); markTask(null, 'sea.today', 'seen') }).not.toThrow()
  })
})
