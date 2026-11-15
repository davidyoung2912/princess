/** A port's guide as the server serves it (`GET /reference/port-guides/{id}`): what the Port Details page shows. */
export interface GuideLink { label: string; url: string }

export interface GuideAttraction {
  name: string
  /** The note after the name, such as "(Teleférico)"; empty when there is none. */
  aka: string
  tier: string
  logistics: { label: string; text: string }[]
  why: string
  links: GuideLink[]
  map: { lat: number; lng: number } | null
}

export interface GuideStats {
  intro: string
  population: string
  landSize: string
  neighbours: string
  safety: string
  government: string
  economy: string
  famousPeople: string
  vibe: string
  timeline: { when: string; text: string }[]
}

/** One line of the list of every port with a guide (`GET /reference/port-guides`). */
export interface PortSummary { id: string; name: string; area: string; shortDescription: string }

/** The ports whose name, area or short description holds every word typed (accents and case ignored); all of them for no words. */
export function filterPorts(ports: readonly PortSummary[], query: string): PortSummary[] {
  const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const words = plain(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...ports]
  return ports.filter((p) => { const hay = plain(`${p.name} ${p.area} ${p.shortDescription}`); return words.every((w) => hay.includes(w)) })
}

export interface PortGuideData {
  id: string
  name: string
  /** The country profile this port belongs to (the id is the flag file and the Country Details page), and its short name. */
  countryId: string
  countryName: string
  area: string
  currencyLanguage: string
  officialLinks: GuideLink[]
  gettingAshore: string
  attractions: GuideAttraction[]
  shortDescription: string
  longDescription: string
  tips: { title: string; text: string }[]
  stats: GuideStats | null
}

/** Directions to a place from where the guest is (their phone fills in the start). */
export const directionsUrl = (p: { lat: number; lng: number }): string => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`

/** Where a place is on the map. */
export const mapUrl = (p: { lat: number; lng: number }): string => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`

/** The attractions grouped by access tier, in the order the tiers first appear, so the easiest-to-reach come first as the documents list them. */
export function byTier(items: readonly GuideAttraction[]): { tier: string; items: GuideAttraction[] }[] {
  const out: { tier: string; items: GuideAttraction[] }[] = []
  for (const a of items) {
    const group = out.find((g) => g.tier === a.tier)
    if (group) group.items.push(a)
    else out.push({ tier: a.tier, items: [a] })
  }
  return out
}

/**
 * What is wrong with a generated guide, as short messages (empty when it is sound). The generator refuses to write a guide with a problem, and a test
 * checks the file the server embeds, so a bad edit to the port documents is caught before it reaches a guest.
 */
export function guideProblems(g: PortGuideData): string[] {
  const out: string[] = []
  const bad = (what: string) => out.push(`${g.id}: ${what}`)
  const web = (url: string) => /^https?:\/\/[^\s/]+\.[^\s/]+/.test(url)
  if (!g.id || !g.name) bad('no id or name')
  if (!g.area) bad('no area')
  if (!g.countryId || !g.countryName) bad('no country profile')
  if (!g.shortDescription) bad('no short description')
  if (!g.longDescription) bad('no long description')
  if (!g.gettingAshore) bad('no getting-ashore text')
  if (g.attractions.length === 0) bad('no attractions')
  if (g.tips.length === 0) bad('no tips')
  if (!g.stats) bad('no stats')
  else if (!g.stats.population || g.stats.timeline.length === 0) bad('stats incomplete')
  for (const l of g.officialLinks) if (!web(l.url)) bad(`official link is not a web address: ${l.url}`)
  const seen = new Set<string>()
  for (const a of g.attractions) {
    const at = `attraction "${a.name}"`
    if (seen.has(a.name)) bad(`${at} appears twice`)
    seen.add(a.name)
    if (!a.tier) bad(`${at} has no access tier`)
    if (!a.why) bad(`${at} has no description`)
    if (a.logistics.length === 0) bad(`${at} has no logistics`)
    if (!a.map) bad(`${at} has no map point`)
    else if (Math.abs(a.map.lat) > 90 || Math.abs(a.map.lng) > 180 || (a.map.lat === 0 && a.map.lng === 0)) bad(`${at} has an impossible map point`)
    for (const l of a.links) if (!web(l.url)) bad(`${at} link is not a web address: ${l.url}`)
  }
  return out
}
