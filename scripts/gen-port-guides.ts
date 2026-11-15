// `npm run portguides:gen`: reads the three port documents in docs/ (port-details.md, port-tips.md, port-stats.md), joins them to the catalogue
// ports (db/seed/catalogue/ports.json) and writes server/Princess.Api/Content/port-guides.json, which the server embeds and serves from
// GET /reference/port-guides and GET /reference/port-guides/{id}. The markdown is the one copy to edit; the JSON is generated from it.
// Ports in the documents that match no catalogue port are listed and left out; catalogue ports with no document entry are listed for information.
import { readFileSync, writeFileSync } from 'node:fs'

const read = (name: string) => readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

export interface GuideLink { label: string; url: string }
export interface Attraction {
  name: string
  /** The italic note after the name, such as "(Teleférico)". */
  aka: string
  tier: string
  logistics: { label: string; text: string }[]
  why: string
  links: GuideLink[]
  map: { lat: number; lng: number } | null
}
export interface PortStats {
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
export interface PortGuide {
  id: string
  name: string
  area: string
  currencyLanguage: string
  officialLinks: GuideLink[]
  gettingAshore: string
  attractions: Attraction[]
  shortDescription: string
  longDescription: string
  tips: { title: string; text: string }[]
  stats: PortStats | null
}

/** Plain text: markdown emphasis and escapes removed. */
const plain = (s: string) => s.replace(/\*\*/g, '').replace(/(^|[^\w])\*([^*]+)\*(?!\w)/g, '$1$2').replace(/\\([$~*_])/g, '$1').replace(/\s+/g, ' ').trim()

const links = (s: string): GuideLink[] => [...s.matchAll(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g)].map((m) => ({ label: plain(m[1]), url: m[2] }))

/** A key that survives accents, case, punctuation and the ", Country" tail, so a document heading finds its catalogue port. */
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase().replace(/[^a-z0-9]/g, '')
function keysOf(name: string): string[] {
  const parts = name.split(',').map((p) => p.trim())
  const out = new Set<string>([strip(name)])
  for (let n = parts.length - 1; n >= 1; n--) out.add(strip(parts.slice(0, n).join(',')))
  const noParen = name.replace(/\([^)]*\)/g, ' ')
  out.add(strip(noParen.split(',')[0]))
  return [...out]
}

interface Port { id: string; name: string }
const catalogue: Port[] = JSON.parse(readFileSync(new URL('../db/seed/catalogue/ports.json', import.meta.url), 'utf8'))
function portFor(heading: string): Port | undefined {
  const wanted = keysOf(heading)
  const exact = catalogue.filter((p) => wanted.includes(strip(p.name)))
  if (exact.length === 1) return exact[0]
  const loose = catalogue.filter((p) => keysOf(p.name).some((k) => wanted.includes(k)))
  return loose.length === 1 ? loose[0] : exact[0]
}

const guides = new Map<string, PortGuide>()
const unmatched: string[] = []
function guide(heading: string): PortGuide | null {
  const clean = heading.trim()
  const port = portFor(clean)
  if (!port) { unmatched.push(clean); return null }
  let g = guides.get(port.id)
  if (!g) {
    g = { id: port.id, name: port.name, area: '', currencyLanguage: '', officialLinks: [], gettingAshore: '', attractions: [], shortDescription: '', longDescription: '', tips: [], stats: null }
    guides.set(port.id, g)
  }
  return g
}

/** "## 3. Name" sections of a document, as heading and body lines. */
function numberedSections(text: string): { heading: string; lines: string[] }[] {
  const out: { heading: string; lines: string[] }[] = []
  let cur: { heading: string; lines: string[] } | null = null
  for (const line of text.split('\n')) {
    const h = /^## \d+\.\s+(.+?)\s*$/.exec(line)
    if (h) { cur = { heading: h[1], lines: [] }; out.push(cur); continue }
    if (/^#{1,2} /.test(line)) { cur = null; continue }
    cur?.lines.push(line)
  }
  return out
}

// ---- port-details.md
for (const { heading, lines } of numberedSections(read('port-details.md'))) {
  const g = guide(heading)
  if (!g) continue
  for (const line of lines) {
    const f = /^\* \*\*(.+?):\*\*\s*(.*)$/.exec(line)
    if (f) {
      const [, key, val] = f
      if (/^country/i.test(key)) g.area = plain(val)
      else if (/^currency/i.test(key)) g.currencyLanguage = plain(val)
      else if (/^official/i.test(key)) g.officialLinks = links(val)
      else if (/^getting ashore/i.test(key)) g.gettingAshore = plain(val)
      continue
    }
    if (!line.startsWith('| **')) continue
    const cells = line.replace(/^\||\|\s*$/g, '').split(/(?<!\\)\|/).map((c) => c.trim())
    if (cells.length !== 5) throw new Error(`port-details: ${heading}: expected 5 cells, got ${cells.length}: ${line.slice(0, 80)}`)
    const [name, tier, logistics, why, rowLinks] = cells
    const nm = /^\*\*(.+?)\*\*\s*(?:\*(.+?)\*)?\s*$/.exec(name)
    const map = /query=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/.exec(rowLinks)
    g.attractions.push({
      name: plain(nm ? nm[1] : name),
      aka: nm?.[2] ? plain(nm[2]) : '',
      tier: plain(tier),
      logistics: logistics.split(/<br\s*\/?>/i).map((p) => /^\*\*(.+?):\*\*\s*(.*)$/.exec(p.trim())).filter((m): m is RegExpExecArray => !!m).map((m) => ({ label: plain(m[1]), text: plain(m[2]) })),
      why: plain(why),
      links: links(rowLinks).filter((l) => !/google\.com\/maps/.test(l.url)),
      map: map ? { lat: Number(map[1]), lng: Number(map[2]) } : null,
    })
  }
}

// ---- port-tips.md
for (const { heading, lines } of numberedSections(read('port-tips.md'))) {
  const g = guide(heading)
  if (!g) continue
  let inTips = false
  for (const line of lines) {
    const f = /^\* \*\*(.+?):\*\*\s*(.*)$/.exec(line)
    if (f) {
      inTips = /^traveler tips/i.test(f[1])
      if (/^short description/i.test(f[1])) g.shortDescription = plain(f[2])
      else if (/^long description/i.test(f[1])) g.longDescription = plain(f[2])
      else if (/^region/i.test(f[1]) && !g.area) g.area = plain(f[2])
      continue
    }
    const tip = /^\s+\* \*\*(.+?):\*\*\s*(.*)$/.exec(line)
    if (inTips && tip) g.tips.push({ title: plain(tip[1]), text: plain(tip[2]) })
  }
}

// ---- port-stats.md (a markdown form with ### headings and "* **Label:**" bullets, then a plain-text form with "• Label:" bullets)
const FLAG = /^(?:#{1,3}\s*)?[\u{1F1E6}-\u{1F1FF}]{2}\s+(.+?)\s*$/u
{
  const lines = read('port-stats.md').split('\n')
  let g: PortGuide | null = null
  let st: PortStats | null = null
  let section = ''
  let waitingIntro = false
  let stray = ''
  for (const raw of lines) {
    const line = raw.trim()
    const h = FLAG.exec(line)
    if (h) {
      g = guide(h[1])
      st = g ? { intro: '', population: '', landSize: '', neighbours: '', safety: '', government: '', economy: '', famousPeople: '', vibe: '', timeline: [] } : null
      if (g && st) g.stats = st
      section = ''
      waitingIntro = true
      continue
    }
    if (!st || !line || /^-{3,}$/.test(line)) continue
    // A document title line sits between a heading and its text in one place (Tokyo); skip it and keep waiting for the intro.
    if (/^The Ultimate .* Data Sheet/.test(line)) continue
    if (/^(?:#{1,3}\s*)?📊/.test(line)) {
      // The Tokyo (Yokohama) block comes after Singapore's with no heading of its own: a second stats block for the same port belongs to the port still without stats.
      if (st.population) {
        const orphan = [...guides.values()].find((x) => x.stats && !x.stats.population)
        if (orphan?.stats) { st = orphan.stats; st.intro = stray }
      }
      section = 'general'; waitingIntro = false; continue
    }
    if (/^(?:#{1,3}\s*)?🛡/.test(line)) { section = 'safety'; continue }
    if (/^(?:#{1,3}\s*)?🎭/.test(line)) { section = 'culture'; continue }
    if (/^(?:#{1,3}\s*)?⏳/.test(line)) { section = 'history'; continue }
    if (/^#/.test(line)) { st = null; continue }
    if (waitingIntro && !/^[*•]/.test(line)) { st.intro = plain(line); waitingIntro = false; continue }
    if (!section && !/^[*•]/.test(line) && !st.intro) { st.intro = plain(line); continue }
    if (section === 'history' && !/^[*•]/.test(line)) { stray = plain(line); continue }
    const b = /^(?:[*•]\s*)(?:\*\*)?([^:*]+?):(?:\*\*)?\s*(.*)$/.exec(line)
    if (!b) continue
    const key = b[1].trim().toLowerCase()
    const val = plain(b[2])
    if (section === 'history') st.timeline.push({ when: plain(b[1]), text: val })
    else if (key === 'population') st.population = val
    else if (key === 'land size') st.landSize = val
    else if (key === 'key neighbors' || key === 'key neighbours') st.neighbours = val
    else if (key === 'safety profile') st.safety = val
    else if (key === 'government & stability') st.government = val
    else if (key === 'economy') st.economy = val
    else if (key === 'famous people') st.famousPeople = val
    else if (key === 'local vibe') st.vibe = val
  }
}

const out = [...guides.values()].sort((a, b) => a.id.localeCompare(b.id))
const problems: string[] = []
for (const g of out) {
  if (!g.shortDescription) problems.push(`${g.id}: no short description (port-tips.md)`)
  if (g.attractions.length === 0) problems.push(`${g.id}: no attractions (port-details.md)`)
  if (!g.stats) problems.push(`${g.id}: no stats (port-stats.md)`)
  else if (!g.stats.population || g.stats.timeline.length === 0) problems.push(`${g.id}: stats incomplete`)
}
const missing = catalogue.filter((p) => !guides.has(p.id)).map((p) => `${p.id} (${p.name})`)

writeFileSync(new URL('../server/Princess.Api/Content/port-guides.json', import.meta.url), '[\n' + out.map((g) => JSON.stringify(g)).join(',\n') + '\n]\n')
console.log(`portguides:gen wrote ${out.length} port guides`)
if (unmatched.length) console.log(`Document ports with no catalogue port (left out):\n  ${[...new Set(unmatched)].join('\n  ')}`)
if (missing.length) console.log(`Catalogue ports with no document entry:\n  ${missing.join('\n  ')}`)
if (problems.length) console.log(`Gaps:\n  ${problems.join('\n  ')}`)
