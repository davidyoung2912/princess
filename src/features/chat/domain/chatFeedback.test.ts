import { describe, expect, it } from 'vitest'
import { chatFeedback, type FeedbackSettings } from './chatFeedback'

const on: FeedbackSettings = { chatSounds: true, chatBuzz: true, calm: false, fun: 'lively' }
const open = { muted: false, dnd: false, urgency: 'normal' as const }

describe('chat sound and buzz', () => {
  it('give both when asked for', () => expect(chatFeedback(on, open)).toEqual({ sound: true, buzz: true }))
  it('give neither when off', () => expect(chatFeedback({ ...on, chatSounds: false, chatBuzz: false }, open)).toEqual({ sound: false, buzz: false }))
  it('can be one without the other', () => expect(chatFeedback({ ...on, chatBuzz: false }, open)).toEqual({ sound: true, buzz: false }))
  it('stay quiet in calm mode and at the Quiet level', () => {
    expect(chatFeedback({ ...on, calm: true }, open)).toEqual({ sound: false, buzz: false })
    expect(chatFeedback({ ...on, fun: 'quiet' }, open)).toEqual({ sound: false, buzz: false })
  })
  it('stay quiet in a muted chat, even for an urgent message', () => expect(chatFeedback(on, { ...open, muted: true, urgency: 'urgent' })).toEqual({ sound: false, buzz: false }))
  it('are silenced by do not disturb except for an urgent message', () => {
    expect(chatFeedback(on, { ...open, dnd: true })).toEqual({ sound: false, buzz: false })
    expect(chatFeedback(on, { ...open, dnd: true, urgency: 'important' })).toEqual({ sound: false, buzz: false })
    expect(chatFeedback(on, { ...open, dnd: true, urgency: 'urgent' })).toEqual({ sound: true, buzz: true })
  })
})
