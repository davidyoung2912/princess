import { useCallback, useEffect, useRef, useState } from 'react'
import { isApiError } from '../api/errors'
import { due, enqueue, failed, isRetryable, loadOutbox, nextWake, saveOutbox, sent, TimeoutError, withTimeout, type OutboxItem } from '../data/outbox'
import { report } from '../diagnostics/watch'
import { useLatest } from './useLatest'

const SEND_TIMEOUT_MS = 15_000

const storage = (): Storage | null => {
  try { return window.localStorage } catch { return null }
}

/** True when a failed send is worth holding and trying again: no signal, a slow link, or a fault that may pass. */
export const worthRetrying = (e: unknown): boolean => e instanceof TimeoutError || (isApiError(e) && isRetryable(e.code))

/** Sends with a time limit, so a stalled link ends in "waiting to send" rather than a spinner that never stops. */
export const sendWithin = <T,>(work: Promise<T>): Promise<T> => withTimeout(work, SEND_TIMEOUT_MS)

/**
 * A short outbox for one kind of action (PERF-04, NET-03): `hold` keeps something that could not be sent, and it is retried with
 * growing gaps, at once when the phone comes back online, and for as long as this screen is open. The list survives a reload.
 */
export function useOutbox(owner: string, kind: OutboxItem['kind'], deliver: (payload: Record<string, string>) => Promise<unknown>, onSent?: () => void) {
  const key = `${owner}:${kind}`
  const [items, setItems] = useState<OutboxItem[]>(() => loadOutbox(storage(), key))
  const list = useRef(items)
  const send = useLatest(deliver)
  const done = useLatest(onSent ?? (() => {}))
  const working = useRef(false)

  const commit = useCallback((next: OutboxItem[]) => {
    list.current = next
    setItems(next)
    saveOutbox(storage(), key, next)
  }, [key])

  const hold = useCallback((payload: Record<string, string>) => {
    commit(enqueue(list.current, { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, kind, payload }, Date.now()))
  }, [commit, kind])

  const flush = useCallback(async () => {
    if (working.current) return
    working.current = true
    try {
      for (const item of due(list.current, Date.now())) {
        try {
          await withTimeout(Promise.resolve(send(item.payload)), SEND_TIMEOUT_MS)
          commit(sent(list.current, item.id))
          done()
        } catch (e) {
          if (worthRetrying(e)) commit(failed(list.current, item.id, Date.now()))
          else { report('error', e); commit(sent(list.current, item.id)) }
        }
      }
    } finally {
      working.current = false
    }
  }, [commit, send, done])

  // Try when something is due, and again when the phone says it is back online. The timer is cleared on every change and on leaving.
  useEffect(() => {
    const wake = nextWake(items)
    if (wake === null) return
    const timer = setTimeout(() => void flush(), Math.max(0, wake - Date.now()))
    return () => clearTimeout(timer)
  }, [items, flush])
  useEffect(() => {
    const online = () => { commit(list.current.map((x) => ({ ...x, nextAt: Date.now() }))); void flush() }
    window.addEventListener('online', online)
    return () => window.removeEventListener('online', online)
  }, [commit, flush])

  return { items, hold }
}
