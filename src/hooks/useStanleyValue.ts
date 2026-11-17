import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeValue, type ValueResult } from '../ai/stanleyValue'
import { stanleyValue } from '../runtime'

/** Value and bill as the server works it out now (phase P6). Nothing is kept on this device; Check again reads it afresh. */
export function useStanleyValue() {
  const [result, setResult] = useState<ValueResult | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const live = useRef(true)

  const read = useCallback(() => stanleyValue.get().then(
    (raw) => { if (live.current) { const next = normalizeValue(raw); setResult(next); setFailed(next === null); setBusy(false) } },
    () => { if (live.current) { setFailed(true); setBusy(false) } },
  ), [])

  useEffect(() => {
    live.current = true
    void read()
    return () => { live.current = false }
  }, [read])

  return { result, failed, busy, check: () => { setBusy(true); return read() } }
}
