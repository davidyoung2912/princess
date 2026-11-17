import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeConsent, normalizePermissions, type StanleyConsentLine, type StanleyPermissions } from '../ai/stanleyPermissions'
import { isApiError } from '../api/errors'
import { stanleyPermissions as api } from '../runtime'

export type StepUpPhase = 'none' | 'ask' | 'sent'
export type Failure = 'load' | 'notYet' | 'needsLevel' | 'wrongCode' | 'expiredCode' | 'tooManyTries' | 'tooSoon' | 'emailUnavailable' | 'other'

const failureOf = (e: unknown): Failure => {
  if (!isApiError(e)) return 'other'
  const m = e.message
  return m === 'notYet' || m === 'needsLevel' || m === 'wrongCode' || m === 'expiredCode' || m === 'tooManyTries' || m === 'tooSoon' || m === 'emailUnavailable' ? m : 'other'
}

/**
 * What the guest lets Stanley do on his own (the server's copy), with the changes the screens make. A change that gives Stanley more to do is refused with `stepUp` until the guest types the
 * code that was emailed; the change is then repeated once with the token. Nothing is kept on the device.
 */
export function useStanleyPermissions(source: 'welcome' | 'settings') {
  const [perms, setPerms] = useState<StanleyPermissions | null>(null)
  const [history, setHistory] = useState<StanleyConsentLine[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [stepUp, setStepUp] = useState<StepUpPhase>('none')
  const pending = useRef<((token?: string) => Promise<unknown>) | null>(null)
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])

  const apply = useCallback((raw: unknown) => {
    const next = normalizePermissions(raw)
    if (!live.current) return
    if (next) setPerms(next); else setFailure('load')
  }, [])

  useEffect(() => { api.get().then(apply, () => { if (live.current) setFailure('load') }) }, [apply])

  const run = useCallback(async (change: (token?: string) => Promise<unknown>, token?: string) => {
    setBusy(true); setFailure(null)
    try {
      apply(await change(token))
      pending.current = null
      if (live.current) setStepUp('none')
    } catch (e) {
      if (isApiError(e) && e.message === 'stepUp') { pending.current = change; if (live.current) setStepUp('ask') }
      else if (live.current) setFailure(failureOf(e))
    } finally { if (live.current) setBusy(false) }
  }, [apply])

  const sendCode = useCallback(async () => {
    setBusy(true); setFailure(null)
    try { await api.sendCode(); if (live.current) setStepUp('sent') } catch (e) { if (live.current) setFailure(failureOf(e)) } finally { if (live.current) setBusy(false) }
  }, [])

  const verify = useCallback(async (code: string) => {
    setBusy(true); setFailure(null)
    try {
      const raw = await api.verifyCode(code)
      const token = typeof raw === 'object' && raw !== null && 'token' in raw && typeof raw.token === 'string' ? raw.token : undefined
      const again = pending.current
      if (token && again) { await run(again, token); return }
      if (live.current) setFailure('other')
    } catch (e) { if (live.current) setFailure(failureOf(e)) } finally { if (live.current) setBusy(false) }
  }, [run])

  return {
    perms, history, busy, failure, stepUp,
    setLevel: (level: number) => run((token) => api.setLevel(level, source, token)),
    setRow: (id: string, on: boolean) => run((token) => api.setRow(id, on, source, token)),
    pause: (until: 'today' | 'forever') => run(() => api.pause(until)),
    resume: () => run(() => api.resume()),
    sendCode, verify,
    cancelStepUp: () => { pending.current = null; setStepUp('none'); setFailure(null) },
    loadHistory: () => { api.history().then((h) => { if (live.current) setHistory(normalizeConsent(h)) }, () => { if (live.current) setHistory([]) }) },
  }
}
