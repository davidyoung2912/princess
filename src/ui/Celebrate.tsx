import { useEffect, useRef, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { playCue } from '../sound/cues'
import { BUZZ, buzz } from '../settings/haptics'
import { StanleyPose } from './StanleyPose'
import type { PoseId } from '../art/manifest'

/** A small, quiet celebration for something the guest finished (docs/look-and-feel-recommendations.md, 5.6). `stamp` presses a mark in; `moment` adds Stanley and a medallion. There is never confetti, a score or a streak.
 * The words are always on screen (a polite status for screen readers). Calm mode hides the picture and the stamp animation, and turns off the sound and buzz. Mount it only right after the guest finishes something (see `src/celebrate/pending.ts`), never on a plain visit. */
export function Celebrate({ level: wanted = 'stamp', pose = 'cheer', children }: { level?: 'stamp' | 'moment'; pose?: PoseId; children: ReactNode }) {
  const [settings] = useSettings()
  // Gentle keeps the small stamp; the Stanley moment is for Lively only.
  const level = settings.fun === 'lively' ? wanted : 'stamp'
  const played = useRef(false)
  useEffect(() => {
    if (played.current) return
    played.current = true
    playCue('success', settings)
    buzz(settings, level === 'moment' ? BUZZ.moment : BUZZ.tick)
  }, [settings, level])
  return (
    <div role="status" className={`celebrate celebrate--${level} motion-land`}>
      <span className="celebrate__medal" aria-hidden="true"><Check size={20} strokeWidth={3} className="tick-draw" /></span>
      {level === 'moment' && <span className="celebrate__pose calm-hide"><StanleyPose pose={pose} size={56} /></span>}
      <p className="celebrate__text">{children}</p>
    </div>
  )
}
