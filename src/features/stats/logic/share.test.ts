import { describe, expect, it } from 'vitest'
import type { StatItem, StatSection, StatsReport } from '../../../shared/api/statsTypes'
import { cardText, highlightItems, reportText, sectionText, statText, visibleSections } from './share'

const item = (o: Partial<StatItem> & { id: string }): StatItem => ({ label: 'Label', value: '1', note: null, joke: false, route: null, ...o })
const resolve = (p: string): string => (p === '/me/stats' ? 'Your stats' : p)

const real: StatSection = { id: 'chat', title: 'Chat', blurb: '', icon: '💬', joke: false, stats: [item({ id: 'chat.msgs', label: 'Messages sent', value: '1,234' }), item({ id: 'chat.fun', label: 'Typing time', value: '9 minutes', joke: true, note: 'Mostly deleting.' })] }
const joke: StatSection = { id: 'seagulls', title: 'Seagull relations', blurb: '', icon: '🐦', joke: true, stats: [item({ id: 's.1', label: 'Seagulls who know you', value: '3', joke: true })] }
const report: StatsReport = { generatedAt: 0, name: 'Ana', headline: '5 days in the app.', realCount: 1, jokeCount: 2, highlights: ['chat.msgs', 'missing', 's.1'], sections: [real, joke] }

describe('statText', () => {
  it('writes label and value', () => expect(statText(real.stats[0], resolve)).toBe('Messages sent: 1,234'))
  it('marks a made-up stat and keeps its note', () => expect(statText(real.stats[1], resolve)).toBe('Typing time: 9 minutes, mostly deleting (made up)'))
  it('names a screen by its title', () => expect(statText(item({ id: 'a', label: 'Favourite screen', value: '', route: '/me/stats', note: 'Visited 3 times' }), resolve)).toBe('Favourite screen: Your stats'))
})

describe('sectionText', () => {
  it('lists the stats under the title', () => expect(sectionText(real, resolve)).toBe('💬 Chat\n• Messages sent: 1,234\n• Typing time: 9 minutes, mostly deleting (made up)'))
  it('can leave made-up stats out, and says nothing for a section left empty', () => {
    expect(sectionText(real, resolve, false)).toBe('💬 Chat\n• Messages sent: 1,234')
    expect(sectionText(joke, resolve, false)).toBe('')
  })
  it('says a made-up section is made up in its title', () => expect(sectionText(joke, resolve)).toContain('Seagull relations (made up)'))
})

describe('report', () => {
  it('finds the highlights it names and skips an unknown id', () => expect(highlightItems(report).map((s) => s.id)).toEqual(['chat.msgs', 's.1']))
  it('makes a short card of the headline and highlights', () => expect(cardText(report, resolve)).toBe("Ana's Cruise Statistics\n5 days in the app.\n• Messages sent: 1,234\n• Seagulls who know you: 3 (made up)"))
  it('shares everything, or only what is real', () => {
    expect(reportText(report, resolve)).toContain('Seagull relations')
    const real_only = reportText(report, resolve, false)
    expect(real_only).not.toContain('Seagull')
    expect(real_only).not.toContain('made up')
  })
  it('hides made-up stats and sections on request', () => {
    const v = visibleSections(report, false)
    expect(v.map((s) => s.id)).toEqual(['chat'])
    expect(v[0].stats.map((s) => s.id)).toEqual(['chat.msgs'])
    expect(visibleSections(report, true)).toHaveLength(2)
  })
})
