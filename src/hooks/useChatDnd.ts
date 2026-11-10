import { useCallback, useEffect, useState } from 'react'
import type { ChatDndMode } from '../api/chatTypes'
import { dndActive, dndRecheckIn } from '../domain/chatDnd'
import { api } from '../runtime'

const CHANGED = 'princess:chat-dnd'

/**
 * One-tap do not disturb, read from the server so every device agrees (docs/chat-urgency-plan.md, phase 4). It ends by itself: a timer looks again at the end time.
 * Every copy of the hook on the screen (the Chat header and the pop-up logic) hears a change made by any of them. A failed read leaves it off, never blocking the guest.
 */
export function useChatDnd(): { active: boolean; until: number; busy: boolean; failed: boolean; set: (mode: ChatDndMode) => void } {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const apply = useCallback((u: number) => { setUntil(u); setNow(Date.now()) }, [])
  useEffect(() => {
    let live = true
    const read = () => { api.chatConnections.dnd().then((d) => { if (live) apply(d.until) }, () => undefined) }
    read()
    const heard = (e: Event) => apply((e as CustomEvent<number>).detail)
    window.addEventListener(CHANGED, heard)
    return () => { live = false; window.removeEventListener(CHANGED, heard) }
  }, [apply])
  useEffect(() => {
    const wait = dndRecheckIn(until, Date.now())
    if (wait === null) return
    const id = window.setTimeout(() => setNow(Date.now()), wait + 50)
    return () => window.clearTimeout(id)
  }, [until, now])
  const set = useCallback((mode: ChatDndMode) => {
    setBusy(true)
    setFailed(false)
    api.chatConnections.setDnd(mode).then(
      (d) => { setBusy(false); apply(d.until); window.dispatchEvent(new CustomEvent(CHANGED, { detail: d.until })) },
      () => { setBusy(false); setFailed(true) },
    )
  }, [apply])
  return { active: dndActive(until, now), until, busy, failed, set }
}
