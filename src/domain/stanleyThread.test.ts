import { describe, expect, it } from 'vitest'
import type { ChatConversation, ChatMessage } from '../api/chatTypes'
import { en } from '../i18n/locales/en'
import { copyAge, IN_THREAD_ACTIONS, isStanleyChat, mayAsk, mentionsAI, noticeOffers, needsYou, noticeBody, noticeHeadline, noticeState, pushPrompt, questionFrom, startsDay, safeNoticePath, subtitleOf, threadItems } from './stanleyThread'
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

  it('starts a new day heading when the calendar day changes', () => {
    const day1 = new Date(2027, 2, 24, 9).getTime()
    const items = [{ at: day1 }, { at: day1 + 3_600_000 }, { at: new Date(2027, 2, 25, 8).getTime() }]
    expect([0, 1, 2].map((i) => startsDay(items, i))).toEqual([true, false, true])
  })
})

describe('notice actions, replies and offline copies (phase 0c)', () => {
  const notice = (o: Partial<NonNullable<ChatMessage['notice']>> = {}): ChatMessage =>
    msg('m', 1, { notice: { lane: 'critical', kind: 'muster', path: '/ship/muster', expired: false, superseded: false, actions: ['confirmMuster'], replies: ['why', 'what'], ...o } })

  it('offers what the server listed while the notice is current', () => {
    expect(noticeOffers(notice())).toEqual({ actions: ['confirmMuster'], replies: ['why', 'what'] })
  })

  it('offers nothing once the notice is replaced or the server says it expired', () => {
    expect(noticeOffers(notice({ superseded: true }))).toEqual({ actions: [], replies: [] })
    expect(noticeOffers(notice({ expired: true }))).toEqual({ actions: [], replies: [] })
  })

  it('loses its buttons by itself when a copy held on the device passes its time, even offline', () => {
    const m = notice({ expiresAt: 1000 })
    expect(noticeOffers(m, 999).actions).toEqual(['confirmMuster'])
    expect(noticeOffers(m, 1000)).toEqual({ actions: [], replies: [] })
    expect(noticeState(m, 1001)).toBe('expired')
    expect(noticeState(m)).toBe('active')
  })

  it('offers nothing on a message that is not a notice', () => {
    expect(noticeOffers(msg('x', 1, { notice: undefined }))).toEqual({ actions: [], replies: [] })
  })

  it('keeps an expired notice out of the Needs you strip', () => {
    const m = notice({ expiresAt: 500, lane: 'critical' })
    m.acked = false
    expect(needsYou([m], 100)).toHaveLength(1)
    expect(needsYou([m], 600)).toHaveLength(0)
  })

  it('runs the muster confirmation and the change card in the thread; everything else opens its own screen', () => {
    expect(IN_THREAD_ACTIONS).toEqual(['confirmMuster', 'reviewChange'])
  })

  it('shows the age of an offline copy, and nothing when it is not known', () => {
    expect(copyAge(5, (at) => `at ${at}`)).toBe('at 5')
    expect(copyAge(undefined, (at) => `at ${at}`)).toBeNull()
    expect(copyAge(Number.NaN, (at) => `at ${at}`)).toBeNull()
  })

  it('asks about phone alerts only when something is time-sensitive, and says what is missed once declined', () => {
    expect(pushPrompt('ask', false, true)).toBe('ask')
    expect(pushPrompt('ask', false, false)).toBeNull()
    expect(pushPrompt('denied', false, false)).toBe('declined')
    expect(pushPrompt('granted', false, true)).toBeNull()
    expect(pushPrompt('unsupported', false, true)).toBeNull()
  })

  it('never asks a supervised account about alerts and gives it no free-text box', () => {
    expect(pushPrompt('ask', true, true)).toBeNull()
    expect(pushPrompt('denied', true, true)).toBeNull()
    expect(mayAsk(true)).toBe(false)
    expect(mayAsk(false)).toBe(true)
  })
})
