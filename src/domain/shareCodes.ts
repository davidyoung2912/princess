/** Hand-over by QR code (docs/chat-bundles-plan.md, 5.6, phase Q1). Framework-free: what a code holds, how a scanned address is read, and the lives a handoff code can have. */
import { BUNDLE_TYPES } from './chatBundles'

/** A direct code holds the public item's type and ref in the address itself (no server call to make); a handoff code holds only a short code. */
export type ShareTarget = { kind: 'direct'; type: string; ref: string } | { kind: 'code'; code: string }

/** The lives a handoff code may have, in minutes. The first is the default. */
export const LIFE_CHOICES: readonly number[] = [15, 60, 1440]

/** The type and ref a share ref names (`menu:crown-grill:dinner` is type `menu`, ref `crown-grill:dinner`), or null when it has no ref part. */
export function splitRef(shareRef: string): { type: string; ref: string } | null {
  const at = shareRef.indexOf(':')
  return at > 0 && at < shareRef.length - 1 ? { type: shareRef.slice(0, at), ref: shareRef.slice(at + 1) } : null
}

/** Whether a ref can be shown as a code: a type in the registry that is shared as a public (direct) item or a private (handoff) one. */
export const qrKindOf = (shareRef: string): 'direct' | 'handoff' | null => {
  const parts = splitRef(shareRef)
  return parts && parts.type in BUNDLE_TYPES ? BUNDLE_TYPES[parts.type]!.qr : null
}

/** The address a direct code holds. */
export const directPath = (shareRef: string): string | null => {
  const parts = splitRef(shareRef)
  return parts ? `/s?t=${encodeURIComponent(parts.type)}&r=${encodeURIComponent(parts.ref)}` : null
}

export const handoffPath = (code: string): string => `/s/${code}`

/** The full address for a QR or a Copy link button. */
export const shareUrl = (origin: string, path: string): string => `${origin}${path}`

/** What a hand-over address (`/s/<code>` or `/s?t=&r=`, as `scanCode` found it) names, or null when it is neither. */
export function parseSharePath(path: string, origin = 'https://app.invalid'): ShareTarget | null {
  let u: URL
  try { u = new URL(path, origin) } catch { return null }
  const code = /^\/s\/([A-Za-z0-9_-]{4,64})$/.exec(u.pathname)
  if (code && u.search === '') return { kind: 'code', code: code[1]! }
  if (u.pathname !== '/s') return null
  const type = u.searchParams.get('t')
  const ref = u.searchParams.get('r')
  return type && ref ? { kind: 'direct', type, ref } : null
}

/** What a failed look-up means for the receiver: a handoff code that does not open says one thing whatever the reason, and a ref this sailing lacks says another. */
export function receiveProblem(error: unknown): 'stopped' | 'notOnSailing' | 'failed' {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : null
  return code === 'notFound' ? 'stopped' : code === 'invalid' ? 'notOnSailing' : 'failed'
}

/** The words for how long a handoff code lasts. */
export const lifeWords = (minutes: number): 'share.life.15' | 'share.life.60' | 'share.life.1440' => (minutes >= 1440 ? 'share.life.1440' : minutes >= 60 ? 'share.life.60' : 'share.life.15')
