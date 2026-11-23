// Derives (see `npm run portexcursions:gen`) a candidate shore-excursion catalogue from the guided and full-day attractions of the port guides
// (server/Princess.Api/Content/port-guides.json) and writes server/Princess.Api/Content/port-excursions.json. docs/review-and-completeness-plan.md (Phase B) explains why:
// the booked catalogue (`ExcursionRules.Catalogue`) holds 12 tours at 3 of the 99 ports the three ships call at. This file is authored concept data like the 12: prices, ratings and
// capacities come from the tour's length and a hash of its id, never from a source. It is NOT yet loaded by the server; wiring it in is the open item in the plan.
import { readFileSync } from 'node:fs'
import type { Attraction } from './gen-port-guides.ts'

const root = new URL('../', import.meta.url)
const json = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, root), 'utf8')) as T

export interface PortExcursion {
  id: string; port: string; name: string; summary: string; hours: number; price: number; activity: 'easy' | 'moderate' | 'strenuous'
  wheelchair: boolean; family: boolean; interests: string[]; rating: number; reviews: number; meeting: string; start: string; capacity: number; source: string
}

const hash = (text: string): number => { let h = 5381; for (const ch of text) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0; return h }
const slug = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const detail = (a: Attraction, label: string): string => a.logistics.find((l) => l.label === label)?.text ?? ''
const isGuided = (a: Attraction): boolean => /Guided|Full-Day|Private/.test(a.tier)

function hoursOf(a: Attraction): number {
  const minutes = Number(/(\d+)\s*(?:–|-|to)?\s*(\d+)?\s*min/.exec(detail(a, 'Travel'))?.slice(1).filter(Boolean).pop() ?? 30)
  const full = /Full-Day/.test(a.tier)
  const h = full ? 5 + (2 * minutes) / 60 : 2 + (2 * minutes) / 60
  return Math.min(9, Math.max(full ? 6 : 3, Math.round(h * 2) / 2))
}

const activityOf = (a: Attraction): PortExcursion['activity'] => {
  const p = detail(a, 'Physical').toLowerCase()
  return /strenuous|steep|hike|demanding/.test(p) && !/^easy/.test(p) ? (/moderate/.test(p) && !/strenuous/.test(p) ? 'moderate' : 'strenuous') : /moderate/.test(p) ? 'moderate' : 'easy'
}

const interestsOf = (a: Attraction): string[] => {
  const t = `${a.name} ${a.why}`.toLowerCase()
  const out = new Set<string>()
  if (/beach|snorkel|reef|boat|sail|lagoon|island|ferry|cruise|fjord/.test(t)) out.add('water')
  if (/temple|museum|cathedral|palace|castle|ruins|history|historic|church|monastery|old town|heritage|fort|shrine|gallery/.test(t)) out.add('culture')
  if (/park|volcano|waterfall|glacier|wildlife|mountain|forest|garden|national|canyon|rainforest|safari|whale/.test(t)) out.add('nature')
  if (/zip|hike|climb|cave|raft|dive|kayak|trek|adventure/.test(t)) out.add('adventure')
  if (out.size === 0) out.add('culture')
  return [...out]
}

export function portExcursions(): PortExcursion[] {
  const guides = json<{ id: string; attractions: Attraction[] }[]>('server/Princess.Api/Content/port-guides.json')
  const out: PortExcursion[] = []
  for (const g of guides) {
    const used = new Set<string>()
    for (const a of g.attractions.filter(isGuided)) {
      const hours = hoursOf(a)
      const activity = activityOf(a)
      const h = hash(`${g.id}|${a.name}`)
      const base = `${g.id.slice(0, 5).replace(/-+$/, '')}-${slug(a.name)}`.slice(0, 38).replace(/-$/, '')
      const id = used.has(base) ? `${base.slice(0, 36)}-${h % 90 + 10}` : base
      used.add(id)
      const physical = detail(a, 'Physical').toLowerCase()
      const step = /step-free|wheelchair|accessible|flat|level|paved/.test(physical) && !/steep|uneven|cobble/.test(physical)
      const summary = (a.why.split(/(?<=[.!?])\s/)[0] ?? a.why).slice(0, 220)
      out.push({
        id, port: g.id, name: a.name.slice(0, 100), summary, hours, price: Math.round((1500 * hours + (/Full-Day/.test(a.tier) ? 2500 : 0) + (h % 5) * 100) / 100) * 100, activity,
        wheelchair: step && activity === 'easy', family: activity !== 'strenuous', interests: interestsOf(a), rating: 4.1 + (h % 8) / 10, reviews: 150 + (h % 1800),
        meeting: 'Meet on the pier beside the gangway, 10 minutes before the start (check the landing in your port guide)', start: /Full-Day/.test(a.tier) ? '08:30' : '09:30', capacity: 24 + (h % 4) * 8,
        source: `port-guides:${g.id}:${a.tier}`,
      })
    }
  }
  return out
}

export const portExcursionsFileText = (): string => '[\n' + portExcursions().map((x) => '  ' + JSON.stringify(x)).join(',\n') + '\n]\n'

