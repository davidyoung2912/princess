/**
 * Plain map maths for the port screens (docs/mcp-integration-plan.md, phase 1). No React and no network: distances, walking times, a visiting
 * order and a projection onto an SVG box, so the same results can be tested in node and drawn with no map tiles. The server's route planner uses the
 * same constants, so the page and Stanley agree on how long a walk takes.
 */

export interface LatLng { lat: number; lng: number }

const EARTH_KM = 6371.0088
const rad = (d: number) => (d * Math.PI) / 180

/** A usable coordinate: finite numbers inside the valid ranges. Anything else is dropped before it reaches a map or a link. */
export function isLatLng(p: unknown): p is LatLng {
  if (!p || typeof p !== 'object') return false
  const { lat, lng } = p as Record<string, unknown>
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export type Pace = 'easy' | 'steady'
/** Kilometres an hour on foot. `easy` is for slower walkers, steps avoided and stops to rest. */
export const WALK_KMH: Record<Pace, number> = { easy: 3.2, steady: 4.5 }
/** Streets are longer than the straight line between two places. */
export const STREET_FACTOR = 1.25

/** Whole minutes to walk the straight-line distance, with the street factor applied, never under one minute for a different place. */
export function walkMinutes(km: number, pace: Pace = 'steady'): number {
  if (!(km > 0)) return 0
  return Math.max(1, Math.round(((km * STREET_FACTOR) / WALK_KMH[pace]) * 60))
}

/** Walking distance to show, in metres under a kilometre and kilometres above, from a straight-line distance (street factor applied). */
export function walkingDistanceLabel(km: number): string {
  const street = km * STREET_FACTOR
  return street < 1 ? `${Math.max(10, Math.round((street * 1000) / 10) * 10)} m` : `${street.toFixed(1)} km`
}

/** Visiting order by nearest next stop, starting from `start` (or from the first point when there is none). Returns indices into `points`. */
export function nearestOrder(points: readonly LatLng[], start?: LatLng | null): number[] {
  const left = points.map((_, i) => i)
  const out: number[] = []
  let here = start ?? (points[0] as LatLng | undefined)
  if (!here) return out
  if (!start) { out.push(0); left.splice(0, 1) }
  while (left.length > 0) {
    let best = 0
    let bestKm = Infinity
    for (let k = 0; k < left.length; k++) {
      const km = distanceKm(here, points[left[k]])
      if (km < bestKm) { bestKm = km; best = k }
    }
    const [next] = left.splice(best, 1)
    out.push(next)
    here = points[next]
  }
  return out
}

/** The distance in kilometres of each leg along `points` in the order given (one fewer than the points). */
export function legsKm(points: readonly LatLng[]): number[] {
  return points.slice(1).map((p, i) => distanceKm(points[i], p))
}

export interface Bounds { minLat: number; maxLat: number; minLng: number; maxLng: number }

export function boundsOf(points: readonly LatLng[]): Bounds | null {
  if (points.length === 0) return null
  return points.reduce<Bounds>((b, p) => ({ minLat: Math.min(b.minLat, p.lat), maxLat: Math.max(b.maxLat, p.lat), minLng: Math.min(b.minLng, p.lng), maxLng: Math.max(b.maxLng, p.lng) }),
    { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity })
}

export interface Projected { x: number; y: number }
export interface Projection { points: Projected[]; width: number; height: number; /** Kilometres in one unit of x (and y), for a scale bar. */ kmPerUnit: number }

/**
 * Fits the points inside `width` by `height` (a padding all round) with north up and the same scale both ways, so distances look right. A single point, or
 * points on top of each other, are drawn in the middle with a minimum area of about 400 metres across so the picture is never a dot.
 */
export function project(points: readonly LatLng[], width: number, height: number, pad = 28): Projection {
  const b = boundsOf(points)
  if (!b) return { points: [], width, height, kmPerUnit: 0 }
  const midLat = (b.minLat + b.maxLat) / 2
  const kx = Math.cos(rad(midLat))
  const minSpanDeg = 0.4 / 111.32
  const spanX = Math.max((b.maxLng - b.minLng) * kx, minSpanDeg)
  const spanY = Math.max(b.maxLat - b.minLat, minSpanDeg)
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY)
  const cx = ((b.minLng + b.maxLng) / 2) * kx
  const cy = (b.minLat + b.maxLat) / 2
  return {
    points: points.map((p) => ({ x: width / 2 + (p.lng * kx - cx) * scale, y: height / 2 - (p.lat - cy) * scale })),
    width,
    height,
    kmPerUnit: 111.32 / scale,
  }
}

/** A round scale-bar length (in km) that fits about a quarter of the width, with its length in drawing units. Null for an empty projection. */
export function scaleBar(p: Projection): { km: number; units: number; label: string } | null {
  if (p.kmPerUnit <= 0) return null
  const target = p.width * 0.25 * p.kmPerUnit
  const steps = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100]
  const km = [...steps].reverse().find((s) => s <= target) ?? steps[0]
  return { km, units: km / p.kmPerUnit, label: km < 1 ? `${Math.round(km * 1000)} m` : `${km} km` }
}
