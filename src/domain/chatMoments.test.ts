import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../api/chatTypes'
import { isMoment, momentView, MOMENT_TOPICS, toggleTopic, topicOn } from './chatMoments'

const card = (over: Partial<NonNullable<ChatMessage['notice']>> = {}): Pick<ChatMessage, 'notice'> => ({
  notice: { lane: 'suggestion', kind: 'moment', path: '/plan/ahead', expired: false, superseded: false, ...over },
})

describe('Stanley suggestion cards', () => {
  it('knows a card by its lane', () => {
    expect(isMoment(card())).toBe(true)
    expect(isMoment({ notice: { lane: 'info', kind: 'x', path: '/', expired: false, superseded: false } })).toBe(false)
    expect(isMoment({})).toBe(false)
  })

  it('shows an open card, a card put away and a card no longer needed', () => {
    expect(momentView(card())).toBe('open')
    expect(momentView(card({ superseded: true }))).toBe('putAway')
    expect(momentView(card({ expired: true }))).toBe('expired')
  })

  it('stops offering the action when its time passes, even offline', () => {
    expect(momentView(card({ expiresAt: 1000 }), 999)).toBe('open')
    expect(momentView(card({ expiresAt: 1000 }), 1000)).toBe('expired')
  })

  it('switches a topic off and on, and drops names it does not know', () => {
    expect(toggleTopic([], 'packing', false)).toEqual(['packing'])
    expect(toggleTopic(['packing'], 'packing', true)).toEqual([])
    expect(toggleTopic(['packing', 'old'], 'steps', false)).toEqual(['packing', 'steps'])
    expect(topicOn(['packing'], 'packing')).toBe(false)
    expect(topicOn(['packing'], 'steps')).toBe(true)
  })

  it('offers the same topics the server accepts', () => {
    expect([...MOMENT_TOPICS]).toEqual(['payment', 'planning', 'packing', 'steps', 'discovery', 'travel'])
  })
})
