import { describe, expect, it } from 'vitest'
import type { ChatExport, ChatSearchHit } from '../api/chatTypes'
import { appendHits, cleanSearch, exportFileName, exportText, groupHits, highlight, isSearchable, searchProblem } from './chatSearch'

const hit = (o: Partial<ChatSearchHit>): ChatSearchHit => ({ conversationId: 'c1', messageId: 'm1', fromName: 'Sam P', mine: false, text: 'pool', at: 1, ...o })

describe('chat search', () => {
  it('tidies the query and refuses one that is too short or long', () => {
    expect(cleanSearch('  pool   deck ')).toBe('pool deck')
    expect(cleanSearch('a')).toBeNull()
    expect(cleanSearch('   ')).toBeNull()
    expect(cleanSearch('x'.repeat(61))).toBeNull()
  })
  it('searches only chats between people', () => {
    for (const kind of ['party', 'direct', 'group'] as const) expect(isSearchable({ kind })).toBe(true)
    for (const kind of ['stanley', 'channel', 'room'] as const) expect(isSearchable({ kind })).toBe(false)
    expect(isSearchable(null)).toBe(false)
  })
  it('marks every match without building markup', () => {
    expect(highlight('Pool by the pool', 'pool')).toEqual([
      { text: 'Pool', match: true }, { text: ' by the ', match: false }, { text: 'pool', match: true },
    ])
    expect(highlight('<b>x</b>', 'zz')).toEqual([{ text: '<b>x</b>', match: false }])
    expect(highlight('', 'a')).toEqual([])
    expect(highlight('abc', ' ')).toEqual([{ text: 'abc', match: false }])
  })
  it('appends older hits without repeats', () => {
    const merged = appendHits([hit({ messageId: 'a' }), hit({ messageId: 'b' })], [hit({ messageId: 'b' }), hit({ messageId: 'c' })])
    expect(merged.map((h) => h.messageId)).toEqual(['a', 'b', 'c'])
  })
  it('groups hits by chat in order of first appearance', () => {
    const groups = groupHits([hit({ conversationId: 'x', messageId: '1' }), hit({ conversationId: 'y', messageId: '2' }), hit({ conversationId: 'x', messageId: '3' })])
    expect(groups.map((g) => [g.conversationId, g.hits.length])).toEqual([['x', 2], ['y', 1]])
  })
  it('names a failed search', () => {
    expect(searchProblem('invalid')).toBe('query')
    expect(searchProblem(undefined, 429)).toBe('rate')
    expect(searchProblem('offline')).toBe('offline')
    expect(searchProblem('boom')).toBe('other')
  })
})

describe('chat export', () => {
  const chat: ChatExport = {
    name: 'My group', at: 100, truncated: true,
    lines: [
      { from: 'You', at: 1, text: 'hello', photo: false, system: false },
      { from: 'Sam P', at: 2, text: '', photo: true, system: false },
      { from: 'Sam P', at: 3, text: 'look', photo: true, system: false },
      { from: 'Sam P', at: 4, text: 'Sam left the group', photo: false, system: true },
    ],
  }
  it('writes a heading and one line per message, naming photos and never carrying them', () => {
    const text = exportText(chat, (at) => `t${at}`)
    expect(text.split('\n')).toEqual(['Chat: My group', 'Saved: t100', 'Only the newest messages are here.', '', 't1  You: hello', 't2  Sam P: [photo]', 't3  Sam P: look [photo]', 't4  [Sam left the group]', ''])
  })
  it('leaves out the cut note when nothing was cut', () => {
    expect(exportText({ ...chat, truncated: false, lines: [] }, () => 't')).not.toContain('newest')
  })
  it('makes a safe file name', () => {
    const at = new Date(2026, 10, 10, 12).getTime()
    expect(exportFileName('Sam / "P"\\..', at)).toBe('chat-Sam-P-2026-11-10.txt')
    expect(exportFileName('!!!', at)).toBe('chat-chat-2026-11-10.txt')
    expect(exportFileName('x'.repeat(80), at).length).toBeLessThan(70)
  })
})
