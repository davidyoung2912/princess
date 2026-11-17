import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeActivity, type StanleyActivity } from '../ai/stanleyActivity'
import { isApiError } from '../api/errors'
import { stanleyActions, stanleyLedger, stanleyMemory, stanleyPermissions } from '../runtime'

export type ActivityFailure = 'load' | 'tooLate' | 'other'

/**
 * What Stanley did, is watching and remembers (the server's copy), with the stop buttons: undo one act, undo all that are still free, switch a watch off, forget an item, pause or resume. Every change goes through
 * the same call the other screens use, then the list is read again, so what is shown is what the server holds.
 */
export function useStanleyActivity() {
  const [activity, setActivity] = useState<StanleyActivity | null>(null)
  const [failure, setFailure] = useState<ActivityFailure | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ undone: number; kept: number } | null>(null)
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])

  const apply = useCallback((raw: unknown) => {
    const next = normalizeActivity(raw)
    if (!live.current) return
    if (next) { setActivity(next); setFailure(null) } else setFailure('load')
  }, [])
  const load = useCallback(() => stanleyLedger.get().then(apply, () => { if (live.current) setFailure('load') }), [apply])
  useEffect(() => { stanleyLedger.get().then(apply, () => { if (live.current) setFailure('load') }) }, [apply])

  const run = useCallback(async (change: () => Promise<unknown>) => {
    setBusy(true); setFailure(null); setNote(null)
    try { await change() } catch (e) { if (live.current) setFailure(isApiError(e) && e.message === 'tooLate' ? 'tooLate' : 'other') }
    await load()
    if (live.current) setBusy(false)
  }, [load])

  return {
    activity, failure, busy, note, retry: load,
    undo: (id: string) => run(() => stanleyActions.undo(id)),
    undoAll: () => run(async () => {
      const raw = await stanleyLedger.undoToday()
      const o = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
      if (live.current) setNote({ undone: typeof o.undone === 'number' ? o.undone : 0, kept: typeof o.kept === 'number' ? o.kept : 0 })
    }),
    stopWatch: (id: string) => run(() => stanleyPermissions.setRow(id, false, 'settings')),
    forget: (id: string) => run(() => stanleyMemory.forget(id)),
    pause: () => run(() => stanleyPermissions.pause('forever')),
    resume: () => run(() => stanleyPermissions.resume()),
  }
}
