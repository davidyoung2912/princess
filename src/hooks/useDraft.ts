import { useCallback, useEffect, useRef, useState } from 'react'
import type { Draft } from '../domain/booking'
import { api } from '../runtime'

export type SaveState = 'idle' | 'saved' | 'saving' | 'failed'

/** Delay after the last change before the draft is saved, so typing is not one save per key. */
export const SAVE_DELAY_MS = 700

/**
 * A booking draft that saves itself (BOK-01). Changes show at once; a save follows a moment after the last one, and
 * `flush` saves immediately (on moving between steps). A failed save leaves the answers on screen and says so.
 */
export function useDraft(initial: Draft) {
  const [draft, setDraft] = useState(initial)
  const [state, setState] = useState<SaveState>('idle')
  const latest = useRef(draft)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const save = useCallback(async () => {
    clearTimeout(timer.current)
    if (!dirty.current) return true
    dirty.current = false
    setState('saving')
    try {
      await api.booking.saveDraft(latest.current)
      setState(dirty.current ? 'saving' : 'saved')
      return true
    } catch {
      dirty.current = true
      setState('failed')
      return false
    }
  }, [])

  const update = useCallback((change: (d: Draft) => Draft) => {
    const next = change(latest.current)
    if (next === latest.current) return
    latest.current = next
    dirty.current = true
    setDraft(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(), SAVE_DELAY_MS)
  }, [save])

  // Anything not yet saved goes out when the screen closes.
  useEffect(() => () => { clearTimeout(timer.current); if (dirty.current) void api.booking.saveDraft(latest.current).catch(() => {}) }, [])

  /** Drops anything unsaved, for when the draft has been used up (booked) or thrown away. */
  const stop = useCallback(() => { dirty.current = false; clearTimeout(timer.current) }, [])

  return { draft, update, flush: save, stop, state }
}
