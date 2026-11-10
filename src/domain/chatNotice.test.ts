import { describe, expect, it } from 'vitest'
import type { ChatConnection, ChatConnections, ChatConversation, ChatSummary } from '../api/chatTypes'
import { arrivals, chooseNotice, chooseUrgentNotice, mayNotify, mayNotifyUrgent, noticePath, requestsWaiting, shouldAck } from './chatNotice'

const sum = (o: Partial<ChatSummary> = {}): ChatSummary => ({ incoming: 0, approvals: 0, answers: 0, newlyConnected: 0, unread: 0, urgentUnacked: 0, urgentConversations: [], ...o })
const conn = (o: Partial<ChatConnection>): ChatConnection => ({ id: 'r1', kind: 'incoming', personId: 'p', name: 'Sam L', conversationId: null, childId: null, childName: null, isNew: false, at: 1, expiresAt: 9, ...o })
const none: ChatConnections = { connected: [], incoming: [], outgoing: [], answers: [], approvals: [] }
const convo = (o: Partial<ChatConversation> & { at?: number; mine?: boolean }): ChatConversation => ({
  id: 'c1', kind: 'direct', name: 'Sam L', members: [], unread: 1, muted: false, closed: false,
  last: { text: 'hi', photo: false, mine: o.mine ?? false, fromName: 'Sam L', at: o.at ?? 1 }, ...o,
}) as ChatConversation

describe('mayNotify and do not disturb', () => {
  it('holds the ordinary pop-up in do not disturb, but never the urgent one', () => {
    expect(mayNotify({ popups: true, calm: false, path: '/home', dnd: true })).toBe(false)
    expect(mayNotify({ popups: true, calm: false, path: '/home', dnd: false })).toBe(true)
    expect(mayNotifyUrgent('/home')).toBe(true)
  })
})

describe('arrivals', () => {
  it('counts only what grew, and nothing on the first numbers', () => {
    expect(arrivals(null, sum({ incoming: 2, unread: 3 }))).toEqual({ requests: 0, messages: 0 })
    expect(arrivals(sum({ incoming: 1, unread: 1 }), sum({ incoming: 2, unread: 4 }))).toEqual({ requests: 1, messages: 3 })
    expect(arrivals(sum({ incoming: 2, unread: 4 }), sum({ incoming: 1, unread: 0 }))).toEqual({ requests: 0, messages: 0 })
  })
})

describe('mayNotify', () => {
  it('is quiet in calm mode, when switched off and inside Chat', () => {
    expect(mayNotify({ popups: true, calm: false, path: '/plan' })).toBe(true)
    expect(mayNotify({ popups: false, calm: false, path: '/plan' })).toBe(false)
    expect(mayNotify({ popups: true, calm: true, path: '/plan' })).toBe(false)
    expect(mayNotify({ popups: true, calm: false, path: '/chat' })).toBe(false)
  })
})

describe('chooseNotice', () => {
  it('prefers a request, and lets only a guest\'s own request be accepted', () => {
    const n = chooseNotice({ requests: 1, messages: 1 }, { ...none, incoming: [conn({})] }, [convo({})])
    expect(n).toMatchObject({ kind: 'request', requestId: 'r1', name: 'Sam L' })
    const child = chooseNotice({ requests: 1, messages: 0 }, { ...none, approvals: [conn({ id: 'a1', kind: 'approval' })] }, [])
    expect(child).toMatchObject({ kind: 'request', requestId: null })
  })
  it('names the newest unmuted unread conversation and skips muted, closed and own', () => {
    const list = [convo({ id: 'old', at: 1, name: 'A' }), convo({ id: 'new', at: 5, name: 'B' }), convo({ id: 'muted', at: 9, muted: true }), convo({ id: 'mine', at: 8, mine: true })]
    expect(chooseNotice({ requests: 0, messages: 1 }, null, list)).toMatchObject({ kind: 'message', conversationId: 'new', name: 'B' })
    expect(chooseNotice({ requests: 0, messages: 1 }, null, [convo({ muted: true })])).toBeNull()
  })
  it('names the sender in a group', () => {
    const g = convo({ kind: 'group', name: 'Dinner crew', unread: 3 })
    expect(chooseNotice({ requests: 0, messages: 1 }, null, [g])).toMatchObject({ name: 'Sam L', count: 3 })
  })
  it('says nothing when nothing arrived', () => {
    expect(chooseNotice({ requests: 0, messages: 0 }, { ...none, incoming: [conn({})] }, [convo({})])).toBeNull()
  })
})

describe('paths and counts', () => {
  it('opens the conversation or the People list', () => {
    expect(noticePath({ key: 'k', kind: 'message', name: 'x', count: 1, requestId: null, conversationId: 'a b' })).toBe('/chat?c=a%20b')
    expect(noticePath({ key: 'k', kind: 'request', name: 'x', count: 1, requestId: 'r', conversationId: null })).toBe('/chat?mode=people')
  })
  it('counts requests including approvals', () => {
    expect(requestsWaiting(null)).toBe(0)
    expect(requestsWaiting(sum({ incoming: 2, approvals: 1, unread: 9 }))).toBe(3)
  })
})

describe('urgent notice', () => {
  it('ignores muted and closed, and picks the newest conversation named as urgent', () => {
    const rows = [convo({ id: 'a', muted: true, at: 1 }), convo({ id: 'b', closed: true, at: 5 }), convo({ id: 'c', at: 9 })]
    const n = chooseUrgentNotice(['a', 'b'], rows)
    expect(n).toMatchObject({ key: 'urgent:b', urgent: true, conversationId: 'b', count: 2 })
    expect(chooseUrgentNotice([], rows)).toBeNull()
    expect(chooseUrgentNotice(['zzz'], rows)).toBeNull()
    expect(chooseUrgentNotice(['a'], null)).toBeNull()
  })
  it('shows everywhere except inside Chat, whatever calm mode says', () => {
    expect(mayNotifyUrgent('/plan')).toBe(true)
    expect(mayNotifyUrgent('/chat')).toBe(false)
    expect(mayNotifyUrgent('/chat/x')).toBe(false)
  })
})

describe('shouldAck', () => {
  it('acknowledges a nudge only while the page is in front, so a hidden app still gets the phone alert', () => {
    expect(shouldAck('visible')).toBe(true)
    expect(shouldAck('hidden')).toBe(false)
  })
})
