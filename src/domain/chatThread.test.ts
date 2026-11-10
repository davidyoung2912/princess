import { describe, expect, it } from 'vitest'
import type { ChatConversation, ChatMessage } from '../api/chatTypes'
import { canTarget, conversationFromSearch, deliveryOf, dividerBefore, QUICK_REPLY_KEYS, quoteSummary, incomingSince, initials, isNearBottom, lastLine, mergeMessages, newClientId, pendingFor, sendProblem, totalUnread, withLatest, withOlder } from './chatThread'

const m = (id: string, from = 'sam'): ChatMessage => ({ id, from, text: id, at: 1 })
const ids = (list: ChatMessage[]) => list.map((x) => x.id)

describe('merging messages', () => {
  it('keeps arrival order and drops repeats', () => {
    expect(ids(mergeMessages([m('a'), m('b')], [m('b'), m('c')]))).toEqual(['a', 'b', 'c'])
  })

  it('puts older messages in front', () => {
    expect(ids(withOlder([m('c'), m('d')], [m('a'), m('b')]))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(withOlder([m('b'), m('c')], [m('a'), m('b')]))).toEqual(['a', 'b', 'c'])
  })

  it('replaces what a refetch of the latest page covers and keeps older pages already loaded', () => {
    const current = [m('a'), m('b'), m('c'), m('d')]
    expect(ids(withLatest(current, [m('c'), m('d'), m('e')]))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('appends a latest page that does not meet what is loaded, and ignores an empty one', () => {
    expect(ids(withLatest([m('a')], [m('x'), m('y')]))).toEqual(['a', 'x', 'y'])
    expect(ids(withLatest([m('a')], []))).toEqual(['a'])
  })
})

describe('following new messages', () => {
  it('follows only near the bottom', () => {
    expect(isNearBottom(920, 400, 1400)).toBe(true)
    expect(isNearBottom(500, 400, 1400)).toBe(false)
    expect(isNearBottom(0, 400, 300)).toBe(true)
  })

  it('reports a new message from someone else, never your own or one already seen', () => {
    expect(incomingSince('a', [m('a'), m('b', 'sam')], 'me')?.id).toBe('b')
    expect(incomingSince('b', [m('a'), m('b', 'sam')], 'me')).toBeNull()
    expect(incomingSince('a', [m('a'), { ...m('b', 'sam'), system: true }], 'me')).toBeNull()
    expect(incomingSince('a', [m('a'), m('b', 'me')], 'me')).toBeNull()
    expect(incomingSince(null, [], 'me')).toBeNull()
  })
})

describe('delivery and the outbox', () => {
  it('is read only when someone has read it', () => {
    expect(deliveryOf({})).toBe('sent')
    expect(deliveryOf({ seenBy: [] })).toBe('sent')
    expect(deliveryOf({ seenBy: ['sam'] })).toBe('read')
    expect(deliveryOf({ delivered: true })).toBe('delivered')
    expect(deliveryOf({ delivered: true, seenBy: ['sam'] })).toBe('read')   // read beats delivered
  })

  it('shows only the waiting messages of this conversation, under their client id', () => {
    const items: { id: string; payload: Record<string, string> }[] = [
      { id: '1', payload: { conversation: 'c1', text: 'hello', clientId: 'k1' } },
      { id: '2', payload: { conversation: 'c2', text: 'other', clientId: 'k2' } },
      { id: '3', payload: { text: 'old shape, no conversation' } as Record<string, string> },
    ]
    expect(pendingFor('c1', items)).toEqual([{ id: 'k1', text: 'hello', state: 'waiting' }])
  })

  it('makes client ids that differ', () => {
    expect(newClientId()).not.toBe(newClientId())
    expect(newClientId()).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('the conversation list', () => {
  const c = (last: ChatConversation['last'], unread = 0): ChatConversation => ({ id: 'x', kind: 'direct', name: 'Sam R.', members: ['Sam R.'], last, unread, muted: false, closed: false, at: 1 })

  it('says who spoke last and falls back to Photo', () => {
    expect(lastLine(c({ text: 'lunch?', photo: false, mine: false, fromName: 'Sam R.', at: 1 }), 'You', 'Photo')).toBe('Sam R.: lunch?')
    expect(lastLine(c({ text: 'on my way', photo: false, mine: true, fromName: '', at: 1 }), 'You', 'Photo')).toBe('You: on my way')
    expect(lastLine(c({ text: '', photo: true, mine: false, fromName: 'Sam R.', at: 1 }), 'You', 'Photo')).toBe('Sam R.: Photo')
    expect(lastLine(c(null), 'You', 'Photo')).toBe('')
  })

  it('adds up unread counts and ignores a negative one', () => {
    expect(totalUnread([c(null, 2), c(null, 0), c(null, 3), c(null, -4)])).toBe(5)
  })

  it('makes initials of one or two letters, never empty', () => {
    expect(initials('Sam R.')).toBe('SR')
    expect(initials('My group')).toBe('MG')
    expect(initials('Cher')).toBe('CH')
    expect(initials('...')).toBe('?')
  })
})

describe('why a send failed', () => {
  it('reads the server code and title', () => {
    expect(sendProblem('invalid', 'blocked')).toBe('blocked')
    expect(sendProblem('invalid', 'contactInfo')).toBe('contact')
    expect(sendProblem('invalid', 'text')).toBe('text')
    expect(sendProblem('conflict', 'closed')).toBe('closed')
    expect(sendProblem('forbidden', 'age')).toBe('age')
    expect(sendProblem('notFound')).toBe('gone')
    expect(sendProblem('network')).toBe('other')
  })
})

describe('links', () => {
  it('reads a conversation id from the address and nothing odd', () => {
    expect(conversationFromSearch('?c=3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301')
    expect(conversationFromSearch('?c=<script>')).toBeNull()
    expect(conversationFromSearch('')).toBeNull()
  })
})

describe('replies, quick replies and the unread divider', () => {
  it('lets only a person\'s message be replied to or reacted to', () => {
    expect(canTarget({})).toBe(true)
    expect(canTarget({ system: true })).toBe(false)
    expect(canTarget({ stanley: true })).toBe(false)
  })

  it('puts the divider above the first unread message only when it is on screen', () => {
    const list = [m('a'), m('b'), m('c')]
    expect(dividerBefore(list, 'b')).toBe('b')
    expect(dividerBefore(list, 'zzz')).toBeNull()
    expect(dividerBefore(list, undefined)).toBeNull()
    expect(dividerBefore(list, null)).toBeNull()
  })

  it('reads a quote as who then what, with You for your own', () => {
    expect(quoteSummary({ text: 'Pool at three', fromName: 'Sam R.' }, 'You')).toBe('Sam R.: Pool at three')
    expect(quoteSummary({ text: 'Pool at three', mine: true }, 'You')).toBe('You: Pool at three')
    expect(quoteSummary({ text: 'Message removed' }, 'You')).toBe('Message removed')
  })

  it('has a fixed set of six quick replies', () => {
    expect(QUICK_REPLY_KEYS).toHaveLength(6)
    expect(new Set(QUICK_REPLY_KEYS).size).toBe(6)
  })
})
