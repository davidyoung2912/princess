import { isLatLng, type LatLng } from './geo'

/**
 * Google Maps links and the optional embed (docs/mcp-integration-plan.md, phase 1). The links are Google's documented keyless Maps URLs: they open the
 * Maps app or site on the guest's own device, which fills in where they are. The embedded map needs a public, referrer-restricted Embed API key
 * (`VITE_GOOGLE_MAPS_EMBED_KEY`); with no key nothing is embedded and nothing is sent to Google until the guest taps a link.
 */

const at = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`

/** Google allows a handful of stops in one link; more than this are left out of the middle. */
export const MAX_STOPS = 9

/** A place pinned on the map. Null for a coordinate that is not valid. */
export function placeUrl(p: LatLng): string | null {
  return isLatLng(p) ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(at(p))}` : null
}

/** Walking directions to one place from wherever the guest is. */
export function directionsToUrl(p: LatLng): string | null {
  return isLatLng(p) ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(at(p))}&travelmode=walking` : null
}

/** Walking directions through the stops in order: the first is the start, the last the end, the rest are waypoints (at most MAX_STOPS in all). Null with fewer than two valid stops. */
export function walkingRouteUrl(stops: readonly LatLng[]): string | null {
  const ok = stops.filter(isLatLng)
  if (ok.length < 2) return null
  const use = ok.length > MAX_STOPS ? [...ok.slice(0, MAX_STOPS - 1), ok[ok.length - 1]] : ok
  const mid = use.slice(1, -1)
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(at(use[0]))}&destination=${encodeURIComponent(at(use[use.length - 1]))}`
    + (mid.length > 0 ? `&waypoints=${encodeURIComponent(mid.map(at).join('|'))}` : '')
    + '&travelmode=walking'
}

/** The address the key-restricted embed loads: a place, or a walking route through the stops. Null without a key or a valid place. */
export function embedUrl(key: string | undefined, stops: readonly LatLng[]): string | null {
  const k = key?.trim()
  if (!k || !/^[A-Za-z0-9_-]{20,80}$/.test(k)) return null
  const ok = stops.filter(isLatLng)
  if (ok.length === 0) return null
  if (ok.length === 1) return `https://www.google.com/maps/embed/v1/place?key=${k}&q=${encodeURIComponent(at(ok[0]))}&zoom=16`
  const use = ok.length > MAX_STOPS ? [...ok.slice(0, MAX_STOPS - 1), ok[ok.length - 1]] : ok
  const mid = use.slice(1, -1)
  return `https://www.google.com/maps/embed/v1/directions?key=${k}&origin=${encodeURIComponent(at(use[0]))}&destination=${encodeURIComponent(at(use[use.length - 1]))}`
    + (mid.length > 0 ? `&waypoints=${encodeURIComponent(mid.map(at).join('|'))}` : '')
    + '&mode=walking'
}

/** The embed key set at build time, or undefined. */
export const embedKey = (): string | undefined => {
  const v = (import.meta.env as Record<string, string | undefined>).VITE_GOOGLE_MAPS_EMBED_KEY
  return v && v.trim() ? v.trim() : undefined
}
