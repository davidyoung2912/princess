/** A message half-typed in a conversation is kept on this device so leaving the screen does not lose it (docs/chat-features-research.md, phase 1). Device only: the server never sees a draft. */
import type { Store } from './chatCache'

const key = (owner: string, id: string): string => `princess.chat.${owner}.draft.${id}`

export const readDraft = (store: Store | null, owner: string, id: string): string => {
  if (!store) return ''
  try { return store.getItem(key(owner, id)) ?? '' } catch { return '' }
}

/** An empty or blank draft removes the entry, so sending a message leaves nothing behind. */
export function saveDraft(store: Store | null, owner: string, id: string, text: string): void {
  if (!store) return
  try {
    if (text.trim() === '') store.removeItem(key(owner, id))
    else store.setItem(key(owner, id), text)
  } catch { /* storage full or blocked: the draft is simply not kept */ }
}
