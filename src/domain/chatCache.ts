/** A small on-device copy of the chat list and the open thread, so Chat shows at once on a slow ship connection and is refreshed behind it (docs/chat-plan.md, 4.8). Framework-free. */
import type { ChatConversation, ChatMessage, ChatThread } from '../api/chatTypes'

const PREFIX = 'princess.chat.'
export const MAX_CACHED_CONVERSATIONS = 50
export const MAX_CACHED_MESSAGES = 30

/** The part of `Storage` used, so a test can pass a plain object. */
export interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

const key = (owner: string, part: string): string => `${PREFIX}${owner}.${part}`

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function read<T>(store: Store | null, k: string, ok: (v: unknown) => v is T): T | null {
  if (!store) return null
  try {
    const raw = store.getItem(k)
    if (!raw) return null
    const v: unknown = JSON.parse(raw)
    return ok(v) ? v : null
  } catch { return null }
}

function write(store: Store | null, k: string, v: unknown): void {
  if (!store) return
  try { store.setItem(k, JSON.stringify(v)) } catch { /* storage full or blocked: the screen works without a copy */ }
}

const isList = (v: unknown): v is ChatConversation[] => Array.isArray(v) && v.every((c) => isObject(c) && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.unread === 'number')
const isThread = (v: unknown): v is ChatThread =>
  isObject(v) && isObject(v.conversation) && typeof v.conversation.id === 'string' && Array.isArray(v.messages) && v.messages.every((m) => isObject(m) && typeof m.id === 'string' && typeof m.text === 'string') && typeof v.hasMore === 'boolean'

export const readList = (store: Store | null, owner: string): ChatConversation[] | null => read(store, key(owner, 'list'), isList)

export const saveList = (store: Store | null, owner: string, list: readonly ChatConversation[]): void => write(store, key(owner, 'list'), list.slice(0, MAX_CACHED_CONVERSATIONS))

export const readThread = (store: Store | null, owner: string, id: string): ChatThread | null => read(store, key(owner, `thread.${id}`), isThread)

/** A cached thread with when it was saved on this device (epoch milliseconds), so an offline copy can say how old it is. `savedAt` is absent on a copy written before this was kept. */
export type CachedThread = ChatThread & { savedAt?: number }
export const readCachedThread = (store: Store | null, owner: string, id: string): CachedThread | null =>
  read(store, key(owner, `thread.${id}`), (v): v is CachedThread => isThread(v) && (!('savedAt' in v) || typeof v.savedAt === 'number'))

/** Text only: a photo is a large data URL, so it is dropped from the copy and fetched live. Only the latest messages are kept, and `hasMore` says older ones exist. */
export function saveThread(store: Store | null, owner: string, id: string, thread: ChatThread, now: number = Date.now()): void {
  const kept: ChatMessage[] = thread.messages.slice(-MAX_CACHED_MESSAGES).map(({ photo: _photo, ...m }) => m)
  write(store, key(owner, `thread.${id}`), { ...thread, messages: kept, hasMore: thread.hasMore || thread.messages.length > kept.length, savedAt: now })
}

/** Removes every chat copy for the person (sign-out, hide me). */
export function clearChatCache(store: Store | null, owner: string, ids: readonly string[]): void {
  if (!store) return
  try {
    store.removeItem(key(owner, 'list'))
    for (const id of ids) store.removeItem(key(owner, `thread.${id}`))
  } catch { /* nothing to clear */ }
}
