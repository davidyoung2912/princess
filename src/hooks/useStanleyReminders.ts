import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeReminders, reminderProblem, type ReminderProblem, type StanleyReminder } from '../ai/stanleyReminders'
import { buildCache, type ReminderCache } from '../ai/stanleyOffline'
import { isApiError } from '../api/errors'
import { loadReminderCopy, saveReminderCopy } from '../data/stanleyOffline'
import { stanleyReminders } from '../runtime'

export type ReminderFailure = 'load' | ReminderProblem

/**
 * The guest's reminders as the server holds them (phase P2a). The plan is sent with the list when the screen has it, so a reminder that follows a plan item or all aboard moves with it. Every change goes to the
 * server and the list that comes back is what is shown; nothing is kept on this device.
 */
export function useStanleyReminders(context?: unknown) {
  const [list, setList] = useState<StanleyReminder[] | null>(null)
  const [failure, setFailure] = useState<ReminderFailure | null>(null)
  const [busy, setBusy] = useState(false)
  // The copy on this phone, for when the list cannot be loaded (phase P3c).
  const [copy] = useState<ReminderCache | null>(loadReminderCopy)
  const live = useRef(true)
  const sent = useRef<string | null>(null)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])

  const apply = useCallback((raw: unknown) => {
    if (!live.current) return
    const next = normalizeReminders(raw)
    saveReminderCopy(buildCache(next, Date.now()))
    setList(next); setFailure(null)
  }, [])
  const load = useCallback(() => stanleyReminders.list().then(apply, () => { if (live.current) setFailure('load') }), [apply])

  // Read the list once; send the plan (again) whenever it changes, which also moves what follows it.
  const key = context === undefined ? null : JSON.stringify(context)
  useEffect(() => {
    if (key !== null && key !== sent.current) {
      sent.current = key
      stanleyReminders.sync(JSON.parse(key) as unknown).then(apply, () => { if (live.current) setFailure('load') })
    } else if (key === null && sent.current === null) {
      sent.current = ''
      stanleyReminders.list().then(apply, () => { if (live.current) setFailure('load') })
    }
  }, [key, apply])

  const run = useCallback(async (change: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true); setFailure(null)
    let problem: ReminderFailure | null = null
    try { await change() } catch (e) { problem = isApiError(e) ? reminderProblem(e.message) : 'other' }
    await load()
    if (live.current) { if (problem) setFailure(problem); setBusy(false) }
    return problem === null
  }, [load])

  return {
    list, copy, failure, busy, retry: load,
    remove: (id: string) => run(() => stanleyReminders.remove(id)),
    edit: (id: string, body: Parameters<typeof stanleyReminders.update>[1]) => run(() => stanleyReminders.update(id, body)),
  }
}
