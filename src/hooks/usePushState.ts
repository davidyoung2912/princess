import { useCallback, useEffect, useState } from 'react'
import { currentEndpoint, currentSupport, getWatched, setBadge, turnOff, turnOn } from '../push/browser'
import type { PushStatus, PushSupport } from '../push/push'
import { api } from '../runtime'

export interface PushState {
  support: PushSupport
  /** Null until the server has answered (or when it could not be reached). */
  status: PushStatus | null
  busy: boolean
  /** A short code for the last failure: "denied" when the guest said no in the browser, otherwise "failed". */
  problem: 'denied' | 'failed' | null
  turnOn: () => Promise<void>
  turnOff: () => Promise<void>
  refresh: () => Promise<void>
}

async function loadStatus(): Promise<PushStatus | null> {
  try { return await api.push.status((await currentEndpoint()) ?? undefined) } catch { return null }
}

/** What this phone can do about alerts and what the server has done, with the two actions. The permission is asked for only inside `turnOn`, which a tap calls. */
export function usePushState(): PushState {
  const [support, setSupport] = useState<PushSupport>(() => currentSupport())
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<'denied' | 'failed' | null>(null)

  const refresh = useCallback(async () => {
    const next = await loadStatus()
    setSupport(currentSupport())
    setStatus(next)
  }, [])

  useEffect(() => {
    let alive = true
    void loadStatus().then((next) => { if (alive) { setSupport(currentSupport()); setStatus(next) } })
    return () => { alive = false }
  }, [])

  const on = useCallback(async () => {
    if (!status) return
    setBusy(true)
    setProblem(null)
    try { setStatus(await turnOn(status, getWatched())) } catch (e) { setProblem(e instanceof Error && e.message === 'denied' ? 'denied' : 'failed') }
    setSupport(currentSupport())
    setBusy(false)
  }, [status])

  const off = useCallback(async () => {
    setBusy(true)
    setProblem(null)
    try { await turnOff(); setBadge(0); await refresh() } catch { setProblem('failed') }
    setBusy(false)
  }, [refresh])

  return { support, status, busy, problem, turnOn: on, turnOff: off, refresh }
}
