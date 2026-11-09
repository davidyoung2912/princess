import { useCallback, useEffect, useState } from 'react'
import { EMPTY_MEMORY_STATE, normalizeMemory, type MemoryState } from '../ai/stanleyMemory'
import { stanleyMemory } from '../runtime'

/** The server's memory for this guest, loaded once and reloaded after every change, so what is shown is always what the server holds. */
export function useStanleyMemory() {
  const [state, setState] = useState<MemoryState>(EMPTY_MEMORY_STATE)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let live = true
    stanleyMemory.get().then(
      (r) => { if (live) { setState(normalizeMemory(r)); setFailed(false); setLoaded(true) } },
      () => { if (live) { setFailed(true); setLoaded(true) } },
    )
    return () => { live = false }
  }, [version])
  /** Runs a change, then reloads; answers whether it worked. A change that fails leaves the list as it was and says so. */
  const change = useCallback(async (run: () => Promise<unknown>): Promise<boolean> => {
    try { await run(); setVersion((v) => v + 1); return true } catch { setFailed(true); return false }
  }, [])
  return { state, loaded, failed, change }
}
