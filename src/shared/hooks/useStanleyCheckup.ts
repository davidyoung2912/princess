import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeCheckup, type Checkup } from '../../features/stanley/logic/stanleyCheckup'
import { stanleyCheckup } from '../../app/runtime'

/** The trip check-up as the server works it out now (phase P3). Nothing is kept on this device; Check again reads it afresh. */
export function useStanleyCheckup() {
  const [result, setResult] = useState<Checkup | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const live = useRef(true)

  const read = useCallback(() => stanleyCheckup.get().then(
    (raw) => { if (live.current) { const next = normalizeCheckup(raw); setResult(next); setFailed(next === null); setBusy(false) } },
    () => { if (live.current) { setFailed(true); setBusy(false) } },
  ), [])

  useEffect(() => {
    live.current = true
    void read()
    return () => { live.current = false }
  }, [read])

  return { result, failed, busy, check: () => { setBusy(true); return read() } }
}
