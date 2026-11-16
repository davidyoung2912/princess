import { useCallback, useState } from 'react'
import { api } from '../runtime'
import { t } from '../i18n'

export interface AddToPlan {
  /** Put events on the plan for the day; resolves true when all went on. */
  add: (events: readonly { id: string; title: string }[]) => Promise<boolean>
  busy: boolean
  /** What a screen reader hears: what was added, or that it could not be. */
  message: string
}

/** One tap to put suggested events on the day's plan. `onDone` runs after any change so the page can reload what it shows. */
export function useAddToPlan(day: number, onDone: () => void): AddToPlan {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const add = useCallback(async (events: readonly { id: string; title: string }[]) => {
    setBusy(true)
    let done = 0
    try {
      for (const e of events) { await api.onboard.togglePlanOn(e.id, day, true); done++ }
      setMessage(events.length === 1 ? t('exp.add.done', { title: events[0].title }) : t('exp.add.doneMany', { count: events.length }))
      return true
    } catch {
      setMessage(t('exp.add.failed'))
      return false
    } finally {
      setBusy(false)
      if (done > 0) onDone()
    }
  }, [day, onDone])
  return { add, busy, message }
}
