/** A country (or territory) profile as the server serves it (`GET /reference/country-guides/{id}`): what the Country Details page shows. */
export interface CountryLink { label: string; url: string }

export interface CountryGuideData {
  /** The lower-case ISO code, also the name of the flag file. */
  id: string
  name: string
  /** The itinerary region the profile is filed under, such as "Caribbean". */
  region: string
  cruiseCalls: string
  /** Set for a territory or special-status place ("not a sovereign state"); empty for a country. */
  status: string
  atAGlance: string
  freedom: string
  government: string
  economy: string
  timeline: string
  people: string
  culture: string
  links: CountryLink[]
  /** The catalogue ports in this country, for links to their guides. */
  ports: { id: string; name: string }[]
}

/** What is wrong with a generated country profile, as short messages (empty when it is sound). The generator refuses a profile with a problem. */
export function countryProblems(g: CountryGuideData): string[] {
  const out: string[] = []
  const bad = (what: string) => out.push(`${g.id}: ${what}`)
  if (!/^[a-z]{2}$/.test(g.id) || !g.name) bad('no id or name')
  if (!g.region) bad('no region')
  if (!g.cruiseCalls) bad('no cruise calls')
  if (!g.atAGlance) bad('no at-a-glance text')
  if (!g.freedom) bad('no freedom score line')
  if (!g.government) bad('no government text')
  if (!g.economy) bad('no economy text')
  if (!g.timeline) bad('no timeline')
  if (!g.people && !g.culture) bad('no people or culture text')
  if (g.links.length === 0) bad('no explore-further links')
  for (const l of g.links) if (!/^https?:\/\/[^\s/]+\.[^\s/]+/.test(l.url)) bad(`link is not a web address: ${l.url}`)
  if (g.ports.length === 0) bad('no catalogue port')
  return out
}
