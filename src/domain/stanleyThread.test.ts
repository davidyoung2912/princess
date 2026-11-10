import { describe, expect, it } from 'vitest'
import type { ChatConversation, ChatMessage } from '../api/chatTypes'
import { en } from '../i18n/locales/en'
import { isStanleyChat, mentionsAI, questionFrom, subtitleOf, threadItems } from './stanleyThread'
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
