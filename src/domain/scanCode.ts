import { PLACES, type Place } from './deck'

/** Reading a scanned or typed code (MOB-10). A code only finds a place or a link; it is never proof that the guest is aboard, boarded or paid. */
export type ScanResult =
  | { kind: 'place'; place: Place }
  | { kind: 'link'; path: string }
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
    if (u.origin === origin && u.pathname.startsWith('/')) return { kind: 'link', path: u.pathname }
  } catch { /* not an address */ }
  return { kind: 'text', text }
}
