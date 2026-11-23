import { artUrl } from '../art/urls'
import type { HeadId, PoseId } from '../art/manifest'

/** A picture of Stanley: a full-body pose or a head-and-shoulders mood. Decorative; the words beside it say what it means. */
export function StanleyPose({ pose, head, size = 96 }: { pose?: PoseId; head?: HeadId; size?: number }) {
  const src = pose ? artUrl({ kind: 'pose', id: pose }) : head ? artUrl({ kind: 'head', id: head }) : undefined
  if (!src) return null
  return <img className="stanley-pose" src={src} alt="" width={size} height={size} loading="lazy" decoding="async" />
}
