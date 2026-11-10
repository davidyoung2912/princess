import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatSummary } from '../api/chatTypes'
import { API_URL, api, auth } from '../runtime'
import { startVisibleInterval } from './visibleInterval'
import { requestsWaiting, shouldAck } from '../domain/chatNotice'
import { closeSettledChatNotices } from '../push/browser'
import { createHubConnection, hubUrl, type HubState } from '../realtime/hubClient'
import { coalesce } from '../domain/coalesce'

const CHANGED = 'princess:chat-changed'
const LIVE = 'princess:chat-live'
/** While the live connection is down, the numbers are read again this often. */
export const POLL_MS = 60_000

/**
 * The one way to read the chat numbers. The badge, the Home row and the conversation list all want them at the same moments (a nudge, focus, a message marked read),
 * so they share one request instead of making one each (see `coalesce`).
 */
export const fetchChatSummary = coalesce(() => api.chatConnections.summary())

let live = false
/** Whether the live connection is up. While it is, a screen need not poll: the server says when something changed. */
export const isChatLive = (): boolean => live

/** Tells every open badge that chat connections changed, so the number on the Chat tab is right after an action. */
export const chatChanged = (): void => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED)) }

/** Runs `onChange` when the server says something changed in chat (a request, an answer, later a message). The screen refetches; the nudge carries no data. */
export function useChatLive(onChange: () => void): void {
  const latest = useRef(onChange)
  useEffect(() => { latest.current = onChange })
  useEffect(() => {
    const run = () => latest.current()
    window.addEventListener(LIVE, run)
    return () => window.removeEventListener(LIVE, run)
  }, [])
}

/**
 * The numbers for the Chat tab badge, from the server so they match on every device. Loaded on launch, when the app comes back to the front, after an action,
 * and when the server nudges over the live connection (docs/chat-plan.md, 4.4). While that connection is down they are read every minute instead.
 * A failed load keeps the last numbers: a badge is never worth an error message.
 */
export function useChatSummary(enabled: boolean): ChatSummary | null {
  const [summary, setSummary] = useState<ChatSummary | null>(null)
  const load = useCallback(() => {
    fetchChatSummary().then((s) => {
      setSummary(s)
      // Read or acknowledged on another device: take this device's stale alerts away.
      void closeSettledChatNotices(s.unread, s.urgentConversations)
    }, () => undefined)
  }, [])
  useEffect(() => {
    if (!enabled) return
    load()
    // Coming back to the front fires both events; they share one request.
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', load)
    window.addEventListener(CHANGED, load)
    document.addEventListener('visibilitychange', onVisible)

    let poll: (() => void) | null = null
    const stopPoll = () => { poll?.(); poll = null }
    const onState = (s: HubState) => {
      live = s === 'live'
      if (s === 'live') { stopPoll(); load() }   // anything missed while it was down
      else if (poll === null) poll = startVisibleInterval(load, POLL_MS)
    }
    const hub = createHubConnection({
      url: () => hubUrl(API_URL, window.location.href, auth.accessToken()),
      onEvent: (target, args) => {
        if (target !== 'chatChanged') return
        const id = (args[0] as { id?: unknown } | undefined)?.id
        if (typeof id === 'string' && shouldAck(document.visibilityState)) hub.send('Ack', [id])
        load()
        window.dispatchEvent(new Event(LIVE))
      },
      onState,
    })
    if (typeof WebSocket !== 'undefined') hub.start()
    else onState('waiting')
    return () => {
      hub.stop()
      live = false
      stopPoll()
      window.removeEventListener('focus', load)
      window.removeEventListener(CHANGED, load)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, load])
  return enabled ? summary : null
}

/** Requests waiting for the guest, for the "needs you" row on Home. Reads the same summary over REST and follows the same nudges and actions, without a second live connection. */
export function useChatWaiting(): number {
  const [n, setN] = useState(0)
  const load = useCallback(() => { fetchChatSummary().then((s) => setN(requestsWaiting(s)), () => undefined) }, [])
  useEffect(() => {
    load()
    window.addEventListener(CHANGED, load)
    window.addEventListener(LIVE, load)
    window.addEventListener('focus', load)
    return () => { window.removeEventListener(CHANGED, load); window.removeEventListener(LIVE, load); window.removeEventListener('focus', load) }
  }, [load])
  return n
}
