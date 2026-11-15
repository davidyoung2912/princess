import type { GuideAttraction, GuideLink, GuideStats, PortGuideData, PortSummary } from '../domain/portGuide'
import { createFeed } from './feed'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

/** Only web links the guest can follow; anything else the server sent is dropped. */
const link = (v: unknown): GuideLink | null => {
  const r = obj(v)
  const url = str(r.url)
  return /^https?:\/\//.test(url) && str(r.label) ? { label: str(r.label), url } : null
}
const links = (v: unknown): GuideLink[] => arr(v).map(link).filter((l): l is GuideLink => l !== null)

function attraction(v: unknown): GuideAttraction | null {
  const r = obj(v)
  if (!str(r.name)) return null
  const m = obj(r.map)
  return {
    name: str(r.name),
    aka: str(r.aka),
    tier: str(r.tier),
    logistics: arr(r.logistics).map(obj).filter((l) => str(l.label) && str(l.text)).map((l) => ({ label: str(l.label), text: str(l.text) })),
    why: str(r.why),
    links: links(r.links),
    map: Number.isFinite(m.lat) && Number.isFinite(m.lng) ? { lat: m.lat as number, lng: m.lng as number } : null,
  }
}

function stats(v: unknown): GuideStats | null {
  if (!v || typeof v !== 'object') return null
  const r = obj(v)
  return {
    intro: str(r.intro), population: str(r.population), landSize: str(r.landSize), neighbours: str(r.neighbours), safety: str(r.safety),
    government: str(r.government), economy: str(r.economy), famousPeople: str(r.famousPeople), vibe: str(r.vibe),
    timeline: arr(r.timeline).map(obj).filter((e) => str(e.text)).map((e) => ({ when: str(e.when), text: str(e.text) })),
  }
}

/** Reads the server's guide for a port; an answer with no id or name gives null. */
export function normalizePortGuide(raw: unknown): PortGuideData | null {
  const r = obj(raw)
  if (!str(r.id) || !str(r.name)) return null
  return {
    id: str(r.id), name: str(r.name), countryId: /^[a-z]{2}$/.test(str(r.countryId)) ? str(r.countryId) : '', countryName: str(r.countryName), area: str(r.area), currencyLanguage: str(r.currencyLanguage), officialLinks: links(r.officialLinks),
    gettingAshore: str(r.gettingAshore), attractions: arr(r.attractions).map(attraction).filter((a): a is GuideAttraction => a !== null),
    shortDescription: str(r.shortDescription), longDescription: str(r.longDescription),
    tips: arr(r.tips).map(obj).filter((t) => str(t.text)).map((t) => ({ title: str(t.title), text: str(t.text) })),
    stats: stats(r.stats),
  }
}

/** One port's guide, kept on the device after the first read so it shows with no signal. */
export const portGuideFeed = createFeed<[port: string], PortGuideData>((p) => p, normalizePortGuide, 'port-guide')

/** Reads the server's list of ports with a guide, by name; entries with no id or name are dropped, and an answer with no usable port gives null. */
export function normalizePortList(raw: unknown): PortSummary[] | null {
  const ports = arr(obj(raw).ports).map(obj).filter((p) => str(p.id) && str(p.name)).map((p) => ({ id: str(p.id), name: str(p.name), area: str(p.area), shortDescription: str(p.shortDescription) }))
  return ports.length > 0 ? ports.sort((a, b) => a.name.localeCompare(b.name)) : null
}

/** Every port with a guide, kept on the device after the first read. */
export const portListFeed = createFeed<[], PortSummary[]>(() => 'all', normalizePortList, 'port-guide-list')
