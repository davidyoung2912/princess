import { describe, expect, it } from 'vitest'
import type { ChatConversation, ChatMessage } from '../api/chatTypes'
import { en } from '../i18n/locales/en'
import { isStanleyChat, mentionsAI, needsYou, noticeBody, noticeHeadline, noticeState, questionFrom, safeNoticePath, subtitleOf, threadItems } from './stanleyThread'
import { sortConversations } from './chatUrgency'

const conv = (id: string, o: Partial<ChatConversation> = {}): ChatConversation =>
  ({ id, kind: 'direct', name: id, members: [], last: null, unread: 0, muted: false, closed: false, at: 0, ...o })
const stanley = (o: Partial<ChatConversation> = {}) => conv('stanley', { kind: 'stanley', permanent: true, name: 'Stanley', voice: 'company', subtitle: 'Princess Cruises', ...o })
const msg = (id: string, at: number, o: Partial<ChatMessage> = {}): ChatMessage => ({ id, from: '0', text: id, at, stanley: true, ...o })

describe('the permanent Stanley chat', () => {
  it('is recognised by its kind or its permanent flag', () => {
    expect(isStanleyChat(stanley())).toBe(true)
    expect(isStanleyChat(conv('x', { permanent: true }))).toBe(true)
    expect(isStanleyChat(conv('x'))).toBe(false)
  })

  it('stays first even when another chat has an urgent message', () => {
    expect(sortConversations([conv('a'), conv('b'), stanley()], ['b']).map((c) => c.id)).toEqual(['stanley', 'b', 'a'])
  })

  it('shows the subtitle the server gave, trimmed, and nothing when there is none', () => {
    expect(subtitleOf(stanley({ subtitle: ' Sun Princess ' }))).toBe('Sun Princess')
    expect(subtitleOf(conv('a'))).toBe('')
  })
})

describe('the thread', () => {
  it('puts the server notices and the questions held on the device in time order', () => {
    const items = threadItems(
      [msg('welcome', 1), msg('line', 5, { system: true })],
      [{ id: 'q1', role: 'user', text: 'When is muster?', at: 3 }, { id: 'a1', role: 'assistant', text: 'At 4:15.', at: 4 }],
    )
    expect(items.map((i) => i.key)).toEqual(['s:welcome', 'd:q1', 'd:a1', 's:line'])
    expect(items.map((i) => i.kind)).toEqual(['server', 'question', 'answer', 'server'])
  })

  it('leaves out an answer with no text', () => {
    expect(threadItems([], [{ id: 'q', role: 'user', text: 'Hi', at: 1 }, { id: 'a', role: 'assistant', text: '  ', at: 2 }]).map((i) => i.kind)).toEqual(['question'])
  })

  it('puts a server message first when the times are equal', () => {
    expect(threadItems([msg('n', 5)], [{ id: 'q', role: 'user', text: 'Hi', at: 5 }]).map((i) => i.key)).toEqual(['s:n', 'd:q'])
  })

  it('shows only the server messages on a second device', () => {
    expect(threadItems([msg('welcome', 1)], []).map((i) => i.key)).toEqual(['s:welcome'])
  })
})

describe('the free-text box', () => {
  it('passes on a trimmed question and nothing when it is empty', () => {
    expect(questionFrom('  When is dinner? ')).toBe('When is dinner?')
    expect(questionFrom('   ')).toBeNull()
  })

  it('cuts a very long question at 500 characters, as the Ask dialog does', () => {
    expect(questionFrom('x'.repeat(900))).toHaveLength(500)
  })
})

describe('no "AI" wording for the guest', () => {
  it('spots the word on its own and not inside other words', () => {
    expect(mentionsAI('Stanley is an AI')).toBe(true)
    expect(mentionsAI('Wait, plain, said')).toBe(false)
  })

  it('fails the build if a Stanley string a guest reads contains it', () => {
    // The thread and its settings use the stanley.chat.* and conv.stanley* keys; the older ai.* and stanley.* keys are covered by the same rule.
    const keys = Object.keys(en).filter((k) => k.startsWith('stanley.chat.') || k.startsWith('conv.stanley'))
    expect(keys.length).toBeGreaterThan(0)
    for (const k of keys) expect(mentionsAI(en[k as keyof typeof en]), k).toBe(false)
  })
})

describe('relayed notices in the Stanley thread', () => {
  const notice = (id: string, at: number, lane: 'critical' | 'important' | 'reminder' | 'info', o: Partial<ChatMessage> & { expired?: boolean; superseded?: boolean } = {}): ChatMessage => {
    const { expired = false, superseded = false, ...rest } = o
    return msg(id, at, { notice: { lane, kind: 'payment', path: '/home', expired, superseded }, acked: lane === 'critical' || lane === 'important' ? false : undefined, ...rest })
  }

  it('is active unless it was replaced or has expired', () => {
    expect(noticeState(notice('a', 1, 'info'))).toBe('active')
    expect(noticeState(notice('a', 1, 'critical', { superseded: true }))).toBe('superseded')
    expect(noticeState(notice('a', 1, 'critical', { expired: true }))).toBe('expired')
    expect(noticeState(msg('plain', 1))).toBe('active')
  })

  it('lists what is outstanding, critical first and then oldest first', () => {
    const list = needsYou([
      notice('imp-old', 1, 'important'), notice('crit-new', 9, 'critical'), notice('crit-old', 5, 'critical'),
      notice('done', 2, 'critical', { acked: true }), notice('gone', 3, 'critical', { expired: true }), notice('replaced', 4, 'important', { superseded: true }),
      notice('rem', 6, 'reminder'), notice('info', 7, 'info'), msg('welcome', 0),
    ])
    expect(list.map((m) => m.id)).toEqual(['crit-old', 'crit-new', 'imp-old'])
  })

  it('splits a notice into its headline and body', () => {
    expect(noticeHeadline('Payment due\nFinal payment is due Friday.')).toBe('Payment due')
    expect(noticeBody('Payment due\nFinal payment is due Friday.')).toBe('Final payment is due Friday.')
    expect(noticeBody('Only a headline')).toBe('')
  })

  it('follows only routes inside the app', () => {
    expect(safeNoticePath('/ship/port')).toBe('/ship/port')
    expect(safeNoticePath('/chat?mode=people')).toBe('/chat?mode=people')
    for (const bad of ['//evil.example', 'https://evil.example', 'javascript:alert(1)', '', undefined]) expect(safeNoticePath(bad)).toBeNull()
  })

  it('says nothing that shows the guest the word AI', () => {
    const words = Object.entries(en).filter(([k]) => k.startsWith('stanley.notice.')).map(([, v]) => String(v))
    expect(words.length).toBeGreaterThan(0)
    for (const w of words) expect(mentionsAI(w)).toBe(false)
  })
})
