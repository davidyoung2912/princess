import { useEffect } from 'react'
import { asGuideView } from '../api/guards'
import { api } from '../../app/runtime'
import { usePersona } from './useDemo'
import { useSavedCopy } from './useSavedCopy'
import { sharedCall } from './useSharedMine'

/**
 * The guest's plan for their stage (docs/next-steps-guidance-plan.md), worked out by the server. The last good answer is kept on the phone, so it still shows with no signal;
 * `stale` is true while the data shown is that kept copy (its age is `at`). Concurrent asks from several screens share one call.
 */
export function useGuide() {
  const me = usePersona()
  const id = me?.id ?? 'none'
  const copy = useSavedCopy('guide', id, () => sharedCall(id, 'guide', () => api.guide.get()), asGuideView, [me?.id])
  const retry = copy.retry
  useEffect(() => {
    window.addEventListener('guide:refresh', retry)
    return () => window.removeEventListener('guide:refresh', retry)
  }, [retry])
  return { ...copy, stale: copy.fromCopy }
}
