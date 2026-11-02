import { describe, expect, it } from 'vitest'
import { screen } from '../ai/guard'
import { buildHandoff, defaultParts, HANDOFF_MAX, hasMessage } from './handoff'

const booking = { guest: 'Ana Reyes', sailing: '2026-11-08', party: 2, open: 3 }
const turns = [
  { role: 'user' as const, text: 'Why was I charged $18?' },
  { role: 'assistant' as const, text: 'It is the daily gratuity.' },
  { role: 'user' as const, text: 'I want to talk to a person' },
]

describe('handoff with context', () => {
  it('puts the question, the booking and the conversation in one message', () => {
    const m = buildHandoff('person', 'I want to talk to a person', turns, booking, defaultParts('person'))!
    expect(m).toMatch(/Wants to talk to a person/)
    expect(m).toMatch(/Guest asked: I want to talk to a person/)
    expect(m).toMatch(/Booking: Ana Reyes, sailing 2026-11-08, 2 guests, 3 checklist items open\./)
    expect(m).toMatch(/Conversation:\nGuest: Why was I charged \$18\?\nConcierge: It is the daily gratuity\./)
  })

  it('makes no message for an emergency', () => {
    expect(hasMessage('emergency')).toBe(false)
    expect(buildHandoff('emergency', 'fire', turns, booking, defaultParts('emergency'))).toBeNull()
    expect(screen('there is a fire')).toBe('emergency')
  })

  it('leaves the conversation out of a medical handoff until it is ticked, and out when unticked', () => {
    expect(defaultParts('medical').conversation).toBe(false)
    const m = buildHandoff('medical', 'my dose?', turns, booking, defaultParts('medical'))!
    expect(m).not.toMatch(/Conversation/)
    expect(buildHandoff('person', 'q', turns, booking, { question: false, booking: false, conversation: false })).toBe('Wants to talk to a person (from the app concierge).')
  })

  it('stays within the limit, dropping the oldest turns first and keeping the newest', () => {
    const long = Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, text: `turn ${i} ${'x'.repeat(200)}` }))
    const m = buildHandoff('person', 'q'.repeat(900), long, booking, defaultParts('person'))!
    expect(m.length).toBeLessThanOrEqual(HANDOFF_MAX)
    expect(buildHandoff('person', 'q', long, booking, defaultParts('person'))!).toMatch(/turn 9/)
    expect(buildHandoff('person', 'q', long, booking, defaultParts('person'))!).not.toMatch(/turn 0/)
  })

  it('says a single guest and an unloaded checklist plainly', () => {
    const m = buildHandoff('legal', 'q', [], { ...booking, party: 1, open: null }, defaultParts('legal'))!
    expect(m).toMatch(/, 1 guest\.$/m)
    expect(m).not.toMatch(/checklist/)
  })
})
