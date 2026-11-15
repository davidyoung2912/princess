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
  /** The at-a-glance line split into labelled facts (population, area, GDP, capital, languages, currency); empty if it could not be split. */
  facts: { label: string; value: string }[]
  /** What follows the facts in the at-a-glance line: where the place is and its neighbours. */
  about: string
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
  for (const label of ['Population', 'Area', 'Economy', 'Capital', 'Language', 'Currency']) if (!g.facts.some((f) => (label === 'Language' ? f.label.endsWith('anguages') : f.label.startsWith(label)) && f.value)) bad(`no ${label.toLowerCase()} fact`)
  if (!g.about) bad('no about sentence')
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

/** One line of the list of every country profile (`GET /reference/country-guides`). `status` is empty for a sovereign state. */
export interface CountrySummary { id: string; name: string; region: string; status: string; cruiseCalls: string }

/** The profiles whose name, region, status or cruise calls hold every word typed (accents and case ignored); all of them for no words. */
export function filterCountries(list: readonly CountrySummary[], query: string): CountrySummary[] {
  const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const words = plain(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...list]
  return list.filter((c) => { const hay = plain(`${c.name} ${c.region} ${c.status} ${c.cruiseCalls}`); return words.every((w) => hay.includes(w)) })
}
