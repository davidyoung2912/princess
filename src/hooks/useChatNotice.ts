import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import type { ChatSummary } from '../api/chatTypes'
import { arrivals, chooseNotice, chooseUrgentNotice, mayNotify, mayNotifyUrgent, type ChatNotice } from '../domain/chatNotice'
import { api } from '../runtime'
import { useChatDnd } from './useChatDnd'
import { useSettings } from './useSettings'

/**
 * The notice to show when the chat numbers say a request or message arrived while the guest is outside Chat (docs/chat-plan.md, phase 8).
 * It reads who and where from the lists over REST, so the live nudge stays a plain "something changed". A failed read shows nothing: the tab count already says it.
 */
export function useChatNotice(summary: ChatSummary | null): { notice: ChatNotice | null; close: () => void } {
  const [settings] = useSettings()
  const dnd = useChatDnd().active
  const { pathname } = useLocation()
  const [notice, setNotice] = useState<ChatNotice | null>(null)
  const prev = useRef<ChatSummary | null>(null)
  const may = useRef(false)
  useEffect(() => { may.current = mayNotify({ popups: settings.chatPopups, calm: settings.calm, path: pathname, dnd }) })
  useEffect(() => {
    if (!summary) { prev.current = null; return }
    const a = arrivals(prev.current, summary)
    prev.current = summary
    if (a.requests + a.messages === 0 || !may.current) return
    void Promise.all([a.requests > 0 ? api.chatConnections.list() : null, a.messages > 0 ? api.chatConversations.list() : null])
      .then(([connections, conversations]) => { const n = chooseNotice(a, connections, conversations); if (n && may.current) setNotice(n) }, () => undefined)
  }, [summary])
  // An unacknowledged urgent message stays until "Got it" and ignores calm mode and the pop-ups setting. The summary says which conversations; the list says who.
  const [urgent, setUrgent] = useState<ChatNotice | null>(null)
  const urgentKey = useRef('')
  const urgentIds = summary?.urgentConversations
  useEffect(() => {
    const key = urgentIds ? [...urgentIds].sort().join(',') : ''
    if (key === urgentKey.current) return
    urgentKey.current = key
    // oxlint-disable-next-line react/set-state-in-effect -- the summary is the external state: no urgent conversations left means the notice goes
    if (!urgentIds || urgentIds.length === 0) { setUrgent(null); return }
    void api.chatConversations.list().then((rows) => { if (urgentKey.current === key) setUrgent(chooseUrgentNotice(urgentIds, rows)) }, () => { urgentKey.current = '' })
  }, [urgentIds])
  const close = useCallback(() => { setUrgent(null); setNotice(null) }, [])
  const showing = mayNotify({ popups: settings.chatPopups, calm: settings.calm, path: pathname, dnd })
  if (urgent && mayNotifyUrgent(pathname)) return { notice: urgent, close }
  return { notice: showing ? notice : null, close }
}
