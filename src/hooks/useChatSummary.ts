import { useCallback, useEffect, useState } from 'react'
import type { ChatSummary } from '../api/chatTypes'
import { api } from '../runtime'

const CHANGED = 'princess:chat-changed'

/** Tells every open badge that chat connections changed, so the number on the Chat tab is right after an action. */
export const chatChanged = (): void => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED)) }

/**
 * The numbers for the Chat tab badge, from the server so they match on every device. Loaded on launch, when the app comes back to the front, and after an action.
 * A failed load keeps the last numbers: a badge is never worth an error message.
 */
export function useChatSummary(enabled: boolean): ChatSummary | null {
  const [summary, setSummary] = useState<ChatSummary | null>(null)
  const load = useCallback(() => { api.chatConnections.summary().then(setSummary, () => undefined) }, [])
  useEffect(() => {
    if (!enabled) return
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', load)
    window.addEventListener(CHANGED, load)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', load)
      window.removeEventListener(CHANGED, load)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, load])
  return enabled ? summary : null
}
