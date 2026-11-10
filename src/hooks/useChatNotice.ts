import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import type { ChatSummary } from '../api/chatTypes'
import { arrivals, chooseNotice, mayNotify, type ChatNotice } from '../domain/chatNotice'
import { api } from '../runtime'
import { useSettings } from './useSettings'

/**
 * The notice to show when the chat numbers say a request or message arrived while the guest is outside Chat (docs/chat-plan.md, phase 8).
 * It reads who and where from the lists over REST, so the live nudge stays a plain "something changed". A failed read shows nothing: the tab count already says it.
 */
export function useChatNotice(summary: ChatSummary | null): { notice: ChatNotice | null; close: () => void } {
  const [settings] = useSettings()
  const { pathname } = useLocation()
  const [notice, setNotice] = useState<ChatNotice | null>(null)
  const prev = useRef<ChatSummary | null>(null)
  const may = useRef(false)
  useEffect(() => { may.current = mayNotify({ popups: settings.chatPopups, calm: settings.calm, path: pathname }) })
  useEffect(() => {
    if (!summary) { prev.current = null; return }
    const a = arrivals(prev.current, summary)
    prev.current = summary
    if (a.requests + a.messages === 0 || !may.current) return
    void Promise.all([a.requests > 0 ? api.chatConnections.list() : null, a.messages > 0 ? api.chatConversations.list() : null])
      .then(([connections, conversations]) => { const n = chooseNotice(a, connections, conversations); if (n && may.current) setNotice(n) }, () => undefined)
  }, [summary])
  const close = useCallback(() => setNotice(null), [])
  const showing = mayNotify({ popups: settings.chatPopups, calm: settings.calm, path: pathname })
  return { notice: showing ? notice : null, close }
}
