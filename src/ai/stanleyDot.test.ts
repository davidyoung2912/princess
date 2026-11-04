import { describe, expect, it } from 'vitest'
import { dotReason, dotShows } from './stanleyDot'
import type { HomeFacts } from '../routes/stageHome'

const facts: HomeFacts = { savedSailings: 0, draft: null, aboard: { musterDone: false, lastFullDay: false } }

describe('stanley speech dot', () => {
  it('needs an urgent reason and a talkative level', () => {
    expect(dotReason('embark', facts, 'helpful')).toBe('muster')
    expect(dotReason('embark', facts, 'chatty')).toBe('muster')
    expect(dotReason('embark', facts, 'asked')).toBeNull()
    expect(dotReason('embark', facts, 'off')).toBeNull()
    expect(dotReason('dream', facts, 'chatty')).toBeNull()
  })
  it('hides once the reason has been seen', () => {
    expect(dotShows('muster', new Set())).toBe(true)
    expect(dotShows('muster', new Set(['muster']))).toBe(false)
    expect(dotShows('bags', new Set(['muster']))).toBe(true)
    expect(dotShows(null, new Set())).toBe(false)
  })
})
