/** Chat search and export (docs/chat-features-research.md, phase 9). Framework-free. */
import type { ChatConversation, ChatExport, ChatSearchHit } from '../api/chatTypes'

export const MIN_QUERY = 2
export const MAX_QUERY = 60

/** The words to search for: spaces folded, 2 to 60 characters. Null when it is too short or too long (the box shows a hint instead of asking the server). */
export function cleanSearch(raw: string): string | null {
  const q = raw.trim().split(/\s+/).filter(Boolean).join(' ')
  return q.length >= MIN_QUERY && q.length <= MAX_QUERY ? q : null
}

/** Search and export cover chats between people only: not Stanley's chat (his cards have their own screens), channels or rooms. Mirrors the server. */
export const isSearchable = (c: Pick<ChatConversation, 'kind'> | null | undefined): boolean => c?.kind === 'party' || c?.kind === 'direct' || c?.kind === 'group'

export interface Segment { text: string; match: boolean }

/** A snippet split into runs so the matched words can be marked (case-insensitive, every match). No markup is built from the text, so nothing in a message can inject any. */
export function highlight(text: string, query: string): Segment[] {
  const q = query.trim().toLowerCase()
  if (!q) return text ? [{ text, match: false }] : []
  const lower = text.toLowerCase()
  const out: Segment[] = []
  let from = 0
  for (;;) {
    const at = lower.indexOf(q, from)
    if (at === -1) break
    if (at > from) out.push({ text: text.slice(from, at), match: false })
    out.push({ text: text.slice(at, at + q.length), match: true })
    from = at + q.length
  }
  if (from < text.length) out.push({ text: text.slice(from), match: false })
  return out
}

/** Older pages go after what is shown; a hit seen twice keeps its first place. */
export function appendHits(current: readonly ChatSearchHit[], more: readonly ChatSearchHit[]): ChatSearchHit[] {
  const seen = new Set(current.map((h) => h.messageId))
  return [...current, ...more.filter((h) => !seen.has(h.messageId))]
}

/** Hits grouped by chat, in the order each chat first appears (so the newest match leads). */
export function groupHits(hits: readonly ChatSearchHit[]): { conversationId: string; hits: ChatSearchHit[] }[] {
  const out: { conversationId: string; hits: ChatSearchHit[] }[] = []
  for (const h of hits) {
    const group = out.find((g) => g.conversationId === h.conversationId)
    if (group) group.hits.push(h)
    else out.push({ conversationId: h.conversationId, hits: [h] })
  }
  return out
}

export type SearchProblem = 'query' | 'rate' | 'offline' | 'other'

/** The sentence key for a failed search: a bad query, too many searches, no connection, anything else. */
export function searchProblem(title: string | undefined, status?: number): SearchProblem {
  if (title === 'invalid' || title === 'query') return 'query'
  if (status === 429 || title === 'rate' || title === 'tooMany') return 'rate'
  if (title === 'offline') return 'offline'
  return 'other'
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A plain, sortable stamp for a file: `2026-11-10 14:05`, on the device's clock. */
export const stamp = (at: number): string => {
  const d = new Date(at)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The saved text of a chat: a heading, then one line per message (`2026-11-10 14:05  Sam P: words`), a photo named and never carried, a line about the group in brackets. */
export function exportText(chat: ChatExport, fmt: (at: number) => string = stamp): string {
  const head = [`Chat: ${chat.name}`, `Saved: ${fmt(chat.at)}`, ...(chat.truncated ? ['Only the newest messages are here.'] : []), '']
  const lines = chat.lines.map((l) => {
    if (l.system) return `${fmt(l.at)}  [${l.text}]`
    const words = [l.text, l.photo ? '[photo]' : ''].filter(Boolean).join(' ')
    return `${fmt(l.at)}  ${l.from}: ${words}`
  })
  return [...head, ...lines, ''].join('\n')
}

/** A safe file name for a saved chat: letters, digits, dashes, no longer than 40 characters, ending `.txt`. */
export function exportFileName(name: string, at: number): string {
  const base = name.normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '')
  const d = new Date(at)
  return `chat-${base || 'chat'}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.txt`
}
