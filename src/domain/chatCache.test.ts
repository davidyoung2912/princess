import { describe, expect, it } from 'vitest'
import type { ChatConversation, ChatThread } from '../api/chatTypes'
import { clearChatCache, MAX_CACHED_MESSAGES, readCachedThread, readList, readThread, saveList, saveThread, type Store } from './chatCache'

const memory = (): Store & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v) }, removeItem: (k) => { data.delete(k) } }
}
const conv = (id: string): ChatConversation => ({ id, kind: 'direct', name: 'Sam R.', members: ['Sam R.'], last: null, unread: 2, muted: false, closed: false, at: 1 })
const thread = (n: number, photo = false): ChatThread => ({
  conversation: conv('c1'), hasMore: false,
  messages: Array.from({ length: n }, (_, i) => ({ id: `m${i}`, from: 'sam', text: `t${i}`, at: i, ...(photo ? { photo: 'data:image/png;base64,AAAA' } : {}) })),
})

describe('the chat copy', () => {
  it('returns what was saved, per person', () => {
    const s = memory()
    saveList(s, 'a', [conv('c1')])
    expect(readList(s, 'a')?.[0].id).toBe('c1')
    expect(readList(s, 'b')).toBeNull()
  })

  it('drops photos and keeps only the latest messages, saying there are more', () => {
    const s = memory()
    saveThread(s, 'a', 'c1', thread(MAX_CACHED_MESSAGES + 5, true))
    const back = readThread(s, 'a', 'c1')!
    expect(back.messages).toHaveLength(MAX_CACHED_MESSAGES)
    expect(back.messages[MAX_CACHED_MESSAGES - 1].id).toBe(`m${MAX_CACHED_MESSAGES + 4}`)
    expect(back.messages.some((m) => m.photo)).toBe(false)
    expect(back.hasMore).toBe(true)
  })

  it('ignores damaged or odd data and a missing or full store', () => {
    const s = memory()
    s.setItem('princess.chat.a.list', '{not json')
    s.setItem('princess.chat.a.thread.c1', JSON.stringify({ messages: 'no' }))
    expect(readList(s, 'a')).toBeNull()
    expect(readThread(s, 'a', 'c1')).toBeNull()
    expect(readList(null, 'a')).toBeNull()
    expect(() => saveList({ ...s, setItem: () => { throw new Error('full') } }, 'a', [conv('c1')])).not.toThrow()
  })

  it('clears a person\'s copies', () => {
    const s = memory()
    saveList(s, 'a', [conv('c1')])
    saveThread(s, 'a', 'c1', thread(2))
    saveList(s, 'b', [conv('c1')])
    clearChatCache(s, 'a', ['c1'])
    expect(readList(s, 'a')).toBeNull()
    expect(readThread(s, 'a', 'c1')).toBeNull()
    expect(readList(s, 'b')).not.toBeNull()
  })

  it('keeps when the copy was saved, so an offline thread can say how old it is', () => {
    const s = memory()
    saveThread(s, 'a', 'c1', thread(2), 1234)
    expect(readCachedThread(s, 'a', 'c1')?.savedAt).toBe(1234)
    expect(readThread(s, 'a', 'c1')?.messages).toHaveLength(2)
  })
})
