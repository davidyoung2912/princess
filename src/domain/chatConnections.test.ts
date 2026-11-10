import { describe, expect, it } from 'vitest'
import type { ChatConnection, ChatConnections } from '../api/chatTypes'
import { askable, chatBadge, cleanQuery, hasActivity, personAction, relationNote, requestProblem, waitingCount } from './chatConnections'

const row = (kind: ChatConnection['kind']): ChatConnection => ({ id: kind, kind, personId: 'p', name: 'Sam L.', conversationId: null, childId: null, childName: null, isNew: false, at: 0, expiresAt: 0 })
const empty: ChatConnections = { connected: [], incoming: [], outgoing: [], answers: [], approvals: [] }

describe('chat connections', () => {
  it('needs 3 to 40 letters to search, and tidies spaces', () => {
    expect(cleanQuery('  Sa ')).toBeNull()
    expect(cleanQuery('  sam   lee ')).toBe('sam lee')
    expect(cleanQuery('x'.repeat(41))).toBeNull()
  })
  it('offers the right action for each relation, and a note for all but none', () => {
    expect(personAction('none')).toBe('ask')
    expect(personAction('connected')).toBe('open')
    for (const r of ['asked', 'waiting', 'approval'] as const) { expect(personAction(r)).toBe('none'); expect(relationNote(r)).toBe(r) }
    expect(relationNote('none')).toBeNull()
  })
  it('adds the badge from the server numbers and never goes below zero', () => {
    expect(chatBadge(null)).toBe(0)
    expect(chatBadge({ incoming: 2, approvals: 1, answers: 1, newlyConnected: 1, unread: 3, urgentUnacked: 0, urgentConversations: [] })).toBe(8)
    expect(chatBadge({ incoming: -1, approvals: 0, answers: 0, newlyConnected: 0, unread: 0, urgentUnacked: 0, urgentConversations: [] })).toBe(0)
    // An urgent message that was read but not acknowledged still counts.
    expect(chatBadge({ incoming: 0, approvals: 0, answers: 0, newlyConnected: 0, unread: 0, urgentUnacked: 1, urgentConversations: ['c'] })).toBe(1)
  })
  it('counts requests waiting for the guest and for their children', () => {
    expect(waitingCount({ ...empty, incoming: [row('incoming')], approvals: [row('approval'), row('approval')] })).toBe(3)
    expect(hasActivity(empty)).toBe(false)
    expect(hasActivity({ ...empty, answers: [row('declined')] })).toBe(true)
  })
  it('keeps only people who can be asked', () => {
    expect(askable([{ id: 'a', name: 'A', relation: 'none' }, { id: 'b', name: 'B', relation: 'connected' }, { id: 'c', name: 'C', relation: 'asked' }]).map((p) => p.id)).toEqual(['a'])
  })
  it('reads a request problem from the detail first, then the code', () => {
    expect(requestProblem('conflict', 'cooldown')).toBe('cooldown')
    expect(requestProblem('notFound', 'notFound')).toBe('notFound')
    expect(requestProblem('server', 'server')).toBe('other')
  })
})
