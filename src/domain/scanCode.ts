import { PLACES, type Place } from './deck'

/** Reading a scanned or typed code (MOB-10). A code only finds a place or a link; it is never proof that the guest is aboard, boarded or paid. */
export type ScanResult =
  | { kind: 'place'; place: Place }
  | { kind: 'link'; path: string }
  /** A code made by another guest's phone to hand something over (`/s/<code>`, or `/s?t=<type>&r=<ref>` for a public item). Never acts by itself; the receive sheet decides what it offers. */
  | { kind: 'share'; path: string }
  | { kind: 'text'; text: string }
  | { kind: 'empty' }

export const SCAN_NOT_PROOF = true

export function readCode(raw: string, origin: string): ScanResult {
  const text = raw.trim().slice(0, 500)
  if (!text) return { kind: 'empty' }
  const key = text.toLowerCase().replace(/^place:/, '')
  const place = PLACES.find((p) => p.id === key)
  if (place) return { kind: 'place', place }
  try {
    const u = new URL(text, origin)
    // Only this app's own addresses are followed; anything else is shown as text and never opened.
    if (u.origin === origin) {
      const share = sharePath(u)
      if (share) return { kind: 'share', path: share }
      if (u.pathname.startsWith('/')) return { kind: 'link', path: u.pathname }
    }
  } catch { /* not an address */ }
  return { kind: 'text', text }
}

const CODE = /^\/s\/[A-Za-z0-9_-]{4,64}$/
const PART = /^[A-Za-z0-9:_.-]{1,80}$/

/** The hand-over address a code holds, or null: `/s/<code>`, or `/s` with only a `t` and an `r` made of plain characters. Anything else on `/s` is not one, so it is read as an ordinary link. */
function sharePath(u: URL): string | null {
  if (CODE.test(u.pathname) && u.search === '') return u.pathname
  if (u.pathname !== '/s') return null
  const keys = [...u.searchParams.keys()].sort().join(',')
  const type = u.searchParams.get('t')
  const ref = u.searchParams.get('r')
  return keys === 'r,t' && type && ref && PART.test(type) && PART.test(ref) ? `/s?t=${encodeURIComponent(type)}&r=${encodeURIComponent(ref)}` : null
}
