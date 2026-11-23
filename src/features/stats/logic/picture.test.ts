import { describe, expect, it } from 'vitest'
import type { StatItem, StatsReport } from '../../../shared/api/statsTypes'
import { pictureLines, wrap } from './picture'

const item = (o: Partial<StatItem> & { id: string }): StatItem => ({ label: o.id, value: '1', note: null, joke: false, route: null, ...o })
const report: StatsReport = {
  generatedAt: 0, name: 'Ana', headline: 'h', realCount: 2, jokeCount: 1, highlights: ['a', 'b', 'c', 'd'],
  sections: [{ id: 's', title: 'S', blurb: '', icon: '', joke: false, stats: [item({ id: 'a', value: '5' }), item({ id: 'b', joke: true, value: '9' }), item({ id: 'c', route: '/me/stats' }), item({ id: 'd' })] }],
}

describe('pictureLines', () => {
  const resolve = (p: string) => (p === '/me/stats' ? 'Your stats' : p)
  it('takes the highlights in order, naming a screen by its title and flagging a made-up stat', () => {
    expect(pictureLines(report, resolve, true)).toEqual([
      { label: 'a', value: '5', joke: false }, { label: 'b', value: '9', joke: true }, { label: 'c', value: 'Your stats', joke: false }, { label: 'd', value: '1', joke: false },
    ])
  })
  it('leaves out made-up stats on request and stops at the maximum', () => {
    expect(pictureLines(report, resolve, false).map((l) => l.label)).toEqual(['a', 'c', 'd'])
    expect(pictureLines(report, resolve, true, 2)).toHaveLength(2)
  })
})

describe('wrap', () => {
  const measure = (s: string) => s.length
  it('breaks at the width without splitting words', () => expect(wrap('one two three four', 9, measure)).toEqual(['one two', 'three', 'four']))
  it('gives a long word its own line', () => expect(wrap('a verylongword b', 5, measure)).toEqual(['a', 'verylongword', 'b']))
  it('returns nothing for no text', () => expect(wrap('  ', 5, measure)).toEqual([]))
})
