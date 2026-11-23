import { describe, expect, it } from 'vitest'
import { guide, task } from '../../guide/logic/fixture'
import { dotReason, dotShows } from './stanleyDot'

const muster = guide('embark', [task('embark.muster', { urgency: 'now', urgencyReason: 'muster' })])

describe('stanley speech dot', () => {
  it('needs an urgent reason and a talkative level', () => {
    expect(dotReason(muster, 'helpful')).toBe('muster')
    expect(dotReason(muster, 'chatty')).toBe('muster')
    expect(dotReason(muster, 'asked')).toBeNull()
    expect(dotReason(muster, 'off')).toBeNull()
    expect(dotReason(guide('dream', [task('dream.quiz')]), 'chatty')).toBeNull()
    expect(dotReason(null, 'chatty')).toBeNull()
  })
  it('hides once the reason has been seen', () => {
    expect(dotShows('muster', new Set())).toBe(true)
    expect(dotShows('muster', new Set(['muster']))).toBe(false)
    expect(dotShows('bags', new Set(['muster']))).toBe(true)
    expect(dotShows(null, new Set())).toBe(false)
  })
})
