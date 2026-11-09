/** Foreground location and compass maths (MOB-13, MOB-22). The guest starts any reading; nothing here runs in the background or stores a position. */
const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180

export interface Fix { lat: number; lon: number; accuracyM: number }

/** Straight-line distance in metres. */
export function distanceMetres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial bearing from a to b, 0 to 359 degrees clockwise from true north. */
export function bearingDegrees(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon))
  return (Math.round((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

const WORDS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'] as const
export const directionWord = (deg: number): (typeof WORDS)[number] => WORDS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]

/** A fix too rough to point with: over 500 m of uncertainty or no number at all. */
export const fixIsRough = (f: Fix): boolean => !Number.isFinite(f.accuracyM) || f.accuracyM > 500

/** Compass heading from a device orientation event: iOS gives `webkitCompassHeading`; an absolute event gives `alpha` counter-clockwise. Null when the device gives neither. */
export function headingFromOrientation(e: { webkitCompassHeading?: number | null; alpha?: number | null; absolute?: boolean }): number | null {
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) return Math.round(e.webkitCompassHeading) % 360
  if (e.absolute && typeof e.alpha === 'number' && Number.isFinite(e.alpha)) return (360 - Math.round(e.alpha) + 360) % 360
  return null
}

/** How far to turn right (positive) or left (negative) from the way the device faces to the bearing; -180 to 180. With no heading the arrow stays north-up, so the caller passes the bearing alone. */
export function turnBy(heading: number | null, bearing: number): number {
  const d = (((bearing - (heading ?? 0)) % 360) + 540) % 360 - 180
  return d === -180 ? 180 : d
}
