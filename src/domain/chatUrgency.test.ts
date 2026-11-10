import { describe, expect, it } from 'vitest'
import type { ChatConversation, ChatMessage } from '../api/chatTypes'
import { ackedCount, announceMode, isUrgencyRefusal, levelsFor, sortConversations, unackedUrgent, urgencyOf } from './chatUrgency'
import { sendProblem } from './chatThread'

const conv = (id: string, o: Partial<ChatConversation> = {}): ChatConversation =>
  ({ id, kind: 'direct', name: id, members: [], last: null, unread: 0, muted: false, closed: false, at: 0, ...o })
const last = (urgency?: 'important' | 'urgent', mine = false) => ({ text: 'x', photo: false, mine, fromName: 'S', at: 1, urgency })
const msg = (o: Partial<ChatMessage>): ChatMessage => ({ id: 'm', from: 'p', text: 't', at: 1, ...o })

describe('levels', () => {
  it('treats absent as normal and offers urgent only when allowed', () => {
    expect(urgencyOf(msg({}))).toBe('normal')
    expect(urgencyOf(null)).toBe('normal')
    expect(levelsFor(false)).toEqual(['normal', 'important'])
    expect(levelsFor(true)).toEqual(['normal', 'important', 'urgent'])
  })
  it('announces urgent assertively and the rest politely', () => {
    expect(announceMode('urgent')).toBe('assertive')
    expect(announceMode('important')).toBe('polite')
    expect(announceMode('normal')).toBe('polite')
  })
})

describe('sortConversations', () => {
  it('pins urgent, then unread important, and keeps the order inside each group', () => {
    const rows = [
      conv('n1', { unread: 2 }),
      conv('i1', { unread: 1, last: last('important') }),
      conv('u1', { muted: true }),
      conv('i-read', { last: last('important') }),
      conv('i-mine', { unread: 1, last: last('important', true) }),
      conv('i-muted', { unread: 1, muted: true, last: last('important') }),
      conv('u2'),
    ]
    expect(sortConversations(rows, ['u2', 'u1']).map((c) => c.id)).toEqual(['u1', 'u2', 'i1', 'n1', 'i-read', 'i-mine', 'i-muted'])
  })
})

describe('acknowledgement', () => {
  it('finds urgent messages from others that are not yet acknowledged', () => {
    const list = [
      msg({ id: 'a', urgency: 'urgent', acked: false }),
      msg({ id: 'b', urgency: 'urgent', acked: true }),
      msg({ id: 'c', urgency: 'important', acked: false }),
      msg({ id: 'd', urgency: 'urgent' }),
      msg({ id: 'e', urgency: 'urgent', acked: false, system: true }),
    ]
    expect(unackedUrgent(list).map((m) => m.id)).toEqual(['a'])
  })
  it('counts who confirmed', () => {
    expect(ackedCount(msg({}))).toBe(0)
    expect(ackedCount(msg({ ackedBy: ['x', 'y'] }))).toBe(2)
  })
})

describe('urgency refusal', () => {
  it('is recognised from the server code and title', () => {
    expect(isUrgencyRefusal('forbidden', 'urgency')).toBe(true)
    expect(isUrgencyRefusal('forbidden', 'age')).toBe(false)
    expect(sendProblem('forbidden', 'urgency')).toBe('urgency')
    expect(sendProblem('forbidden', 'age')).toBe('age')
  })
})
