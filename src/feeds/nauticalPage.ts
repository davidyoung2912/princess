import type { AlongTheWay, SeaConditions, ShipPosition } from '../domain/navigation'
import type { Nautical } from '../domain/nautical'
import type { SkyNight } from '../domain/sky'
import type { ShipWeather } from '../domain/weather'
import { createFeed, isRecord } from './feed'
import { normalizeAlong, normalizePosition, normalizeSea } from './navigation'
import { normalizeNautical } from './nautical'
import { normalizeSkyNight } from './skyNight'
import { normalizeWeather } from './weather'

/** Everything the Nautical details page shows. A part the server sent badly is null and its section is left out; the rest still show. */
export interface NauticalPage {
  position: ShipPosition | null
  sea: SeaConditions | null
  nautical: Nautical | null
  along: AlongTheWay | null
  weather: ShipWeather | null
  sky: SkyNight | null
}

export function normalizeNauticalPage(raw: unknown): NauticalPage | null {
  if (!isRecord(raw)) return null
  const page: NauticalPage = {
    position: normalizePosition(raw.position),
    sea: normalizeSea(raw.sea),
    nautical: normalizeNautical(raw.nautical),
    along: normalizeAlong(raw.along),
    weather: normalizeWeather(raw.weather),
    sky: normalizeSkyNight(raw.sky),
  }
  return Object.values(page).every((v) => v === null) ? null : page
}

/** All six answers for a whole minute of a sailing and a cruise day, from one request. Not kept on the device: an old position is not a position. */
export const nauticalPageFeed = createFeed<[sailing: string, minute: number, day: number], NauticalPage>((s, m, d) => `${s}|${m}|${d}`, normalizeNauticalPage)
