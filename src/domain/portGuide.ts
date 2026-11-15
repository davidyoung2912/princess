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

export interface PortGuideData {
  id: string
  name: string
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
