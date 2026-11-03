import { useEffect } from 'react'
import { updateRecent } from '../recent/store'
import { withVisit } from '../routes/recent'

const DWELL_MS = 2000

/** Records a screen as "recent" once the guest has stayed on it a moment, and not when they only went Back or Forward to it. */
export function useRecentVisit(personId: string | null, pathname: string, via: 'PUSH' | 'REPLACE' | 'POP', skip: boolean): void {
  useEffect(() => {
    if (!personId || skip || via === 'POP') return
    const timer = setTimeout(() => updateRecent(personId, (s) => withVisit(s, pathname, Date.now())), DWELL_MS)
    return () => clearTimeout(timer)
  }, [personId, pathname, via, skip])
}
