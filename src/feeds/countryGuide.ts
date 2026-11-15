import type { CountryGuideData, CountryLink, CountrySummary } from '../domain/countryGuide'
import { createFeed } from './feed'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

/** Only web links the guest can follow; anything else the server sent is dropped. */
const link = (v: unknown): CountryLink | null => {
  const r = obj(v)
  return /^https?:\/\//.test(str(r.url)) && str(r.label) ? { label: str(r.label), url: str(r.url) } : null
}

/** Reads the server's profile for a country; an answer with no usable id or name gives null. */
export function normalizeCountryGuide(raw: unknown): CountryGuideData | null {
  const r = obj(raw)
  if (!/^[a-z]{2}$/.test(str(r.id)) || !str(r.name)) return null
  return {
    id: str(r.id), name: str(r.name), region: str(r.region), cruiseCalls: str(r.cruiseCalls), status: str(r.status), atAGlance: str(r.atAGlance),
    freedom: str(r.freedom), government: str(r.government), economy: str(r.economy), timeline: str(r.timeline), people: str(r.people), culture: str(r.culture),
    links: arr(r.links).map(link).filter((l): l is CountryLink => l !== null),
    ports: arr(r.ports).map(obj).filter((p) => str(p.id) && str(p.name)).map((p) => ({ id: str(p.id), name: str(p.name) })),
  }
}

/** One country's profile, kept on the device after the first read so it shows with no signal. */
export const countryGuideFeed = createFeed<[country: string], CountryGuideData>((c) => c, normalizeCountryGuide, 'country-guide')

/** Reads the server's list of country profiles by name; entries with no usable code or name are dropped, and an answer with none gives null. */
export function normalizeCountryList(raw: unknown): CountrySummary[] | null {
  const list = arr(obj(raw).countries).map(obj).filter((c) => /^[a-z]{2}$/.test(str(c.id)) && str(c.name))
    .map((c) => ({ id: str(c.id), name: str(c.name), region: str(c.region), status: str(c.status), cruiseCalls: str(c.cruiseCalls) }))
  return list.length > 0 ? list.sort((a, b) => a.name.localeCompare(b.name)) : null
}

/** Every country profile, kept on the device after the first read. */
export const countryListFeed = createFeed<[], CountrySummary[]>(() => 'all', normalizeCountryList, 'country-guide-list')
