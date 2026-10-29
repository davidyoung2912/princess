import type { DataStore } from '../data/store'
import type { ChatMessage } from './types'

/** The conversation, kept on this device for the signed-in guest and clearable (SUP-03). One thread per person. */
const KIND = 'concierge'
const ID = 'thread'
/** The most messages kept; older ones drop off. */
export const KEEP = 60

const isMessage = (m: unknown): m is ChatMessage => !!m && typeof m === 'object' && ['user', 'assistant'].includes((m as ChatMessage).role) && typeof (m as ChatMessage).text === 'string' && typeof (m as ChatMessage).at === 'number'

export async function loadThread(store: DataStore, owner: string): Promise<ChatMessage[]> {
  const rec = await store.get(KIND, owner, ID)
  const messages = (rec?.data as { messages?: unknown } | undefined)?.messages
  return Array.isArray(messages) ? messages.filter(isMessage) : []
}

export async function saveThread(store: DataStore, owner: string, messages: readonly ChatMessage[], now: number): Promise<void> {
  await store.put({ kind: KIND, owner, id: ID, updatedAt: now, data: { messages: messages.slice(-KEEP) } })
}

export const clearThread = (store: DataStore, owner: string): Promise<void> => store.delete(KIND, owner, ID)
