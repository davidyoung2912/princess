import { useCallback, useEffect, useState } from 'react'
import { readCapsule, readStorageReport, requestPersistence } from '../data/capsule'
import type { Capsule, StorageReport } from '../domain/offlineCapsule'

export interface CapsuleView {
  capsule: Capsule
  storage: StorageReport
  /** When the capsule was last checked (the demo clock). */
  checkedAt: number
  /** Reads everything again (the "check now" test). */
  check: () => void
  /** Asks the browser to keep what is saved; resolves to whether it agreed. The browser may decline, so the answer is shown, never assumed. */
  protect: () => Promise<boolean>
}

/** What this phone has kept for use offline, and whether the browser has promised to keep it (MOB-03, MOB-04, OFF-07). */
export function useCapsule(): CapsuleView {
  const [read, setRead] = useState(readCapsule)
  const [storage, setStorage] = useState<StorageReport>({ usage: null, quota: null, persisted: null })

  useEffect(() => {
    let live = true
    void readStorageReport().then((r) => { if (live) setStorage(r) })
    return () => { live = false }
  }, [read])

  const check = useCallback(() => setRead(readCapsule()), [])
  const protect = useCallback(async () => {
    const granted = await requestPersistence()
    setStorage(await readStorageReport())
    return granted
  }, [])

  return { capsule: read.capsule, storage, checkedAt: read.at, check, protect }
}
