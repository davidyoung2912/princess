// `npm run countryguides:gen`: reads docs/cruise_country_reference_guide.md and writes server/Princess.Api/Content/country-guides.json, which the server
// embeds and serves from GET /reference/country-guides and GET /reference/country-guides/{id}. The markdown is the one copy to edit.
// Each profile is joined to the catalogue ports of its country (db/seed/catalogue/ports.json) so a country page can list the ports that call there.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { COUNTRY_PROFILES } from './countryCodes.ts'
import { countryProblems, type CountryGuideData } from '../src/domain/countryGuide.ts'

const text = readFileSync(new URL('../docs/cruise_country_reference_guide.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const catalogue: { id: string; name: string; countryCode: string }[] = JSON.parse(readFileSync(new URL('../db/seed/catalogue/ports.json', import.meta.url), 'utf8'))

const plain = (s: string) => s.replace(/\*\*/g, '').replace(/(^|[^\w])\*([^*]+)\*(?!\w)/g, '$1$2').replace(/\\([$~*_])/g, '$1').replace(/\s+/g, ' ').trim()
const links = (s: string) => [...s.matchAll(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g)].map((m) => ({ label: plain(m[1]), url: m[2] }))

/**
 * Splits the "At a glance" line ("Population about 27.6 million; area ...; capital X; language Y; currency Z (ABC). Where it is.") into labelled facts and
 * the closing sentences. A line it cannot read gives no facts, which the generator reports and the page covers by showing the whole line.
 */
export function splitGlance(line: string): { facts: { label: string; value: string }[]; about: string } {
  const facts: { label: string; value: string }[] = []
  const about: string[] = []
  const parts = line.split('; ')
  let seenCapital = false
  let done = false
  for (const raw of parts) {
    let part = raw.trim()
    if (done) { about.push(part); continue }
    let m: RegExpExecArray | null
    if ((m = /^Population\s+(.*)$/i.exec(part))) facts.push({ label: 'Population', value: m[1] })
    else if ((m = /^(?:land )?area\s+(.*)$/i.exec(part))) facts.push({ label: 'Area', value: m[1] })
    else if ((m = /^nominal GDP\s+(.*)$/i.exec(part))) facts.push({ label: 'Economy (GDP)', value: m[1] })
    else if ((m = /^capital\s+(?:is\s+)?(.*)$/i.exec(part))) { facts.push({ label: 'Capital', value: m[1] }); seenCapital = true }
    else if ((m = /^currency\s+(.*)$/i.exec(part))) {
      // The currency is the last fact; the sentences after its full stop describe the place.
      const cut = /^(.*?[)\w])\.\s+(.*)$/.exec(m[1])
      facts.push({ label: 'Currency', value: (cut ? cut[1] : m[1]).replace(/\.$/, '') })
      if (cut) about.push(cut[2])
      done = true
    } else if (seenCapital) {
      const official = /^official\s+/i.test(part)
      part = part.replace(/^(?:official\s+)?languages?\s+(?:include\s+)?/i, '')
      const label = official ? 'Official languages' : 'Languages'
      const prior = facts.find((x) => x.label.endsWith('anguages'))
      if (prior) prior.value += `; ${part}`
      else facts.push({ label, value: part })
    } else about.push(part)
  }
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return { facts: facts.map((f) => ({ label: f.label, value: cap(f.value) })), about: about.join('; ').trim() }
}

const start = text.indexOf('\n# Caribbean')
const end = text.indexOf('\n# Making this useful')
if (start < 0 || end < 0) throw new Error('country guide: the region headings were not found')

const guides: CountryGuideData[] = []
const unknown: string[] = []
let region = ''
let cur: { heading: string; region: string; lines: string[] } | null = null
const sections: { heading: string; region: string; lines: string[] }[] = []
for (const line of text.slice(start, end).split('\n')) {
  const r = /^# (.+?)\s*$/.exec(line)
  if (r) { region = r[1]; cur = null; continue }
  const h = /^## (.+?)\s*$/.exec(line)
  if (h) { cur = { heading: h[1], region, lines: [] }; sections.push(cur); continue }
  cur?.lines.push(line)
}

for (const s of sections) {
  const profile = COUNTRY_PROFILES[s.heading]
  if (!profile) { unknown.push(s.heading); continue }
  const g: CountryGuideData = {
    id: profile.id, name: profile.name, region: s.region, cruiseCalls: '', status: '', atAGlance: '', freedom: '', government: '', economy: '',
    facts: [], about: '', timeline: '', people: '', culture: '', links: [], ports: catalogue.filter((p) => p.countryCode.toLowerCase() === profile.id).map((p) => ({ id: p.id, name: p.name })),
  }
  for (const line of s.lines) {
    const m = /^\*\*(.+?)\*\*\s*(.*)$/.exec(line.trim())
    if (!m) continue
    const label = m[1].replace(/[.:]+$/, '').trim().toLowerCase()
    const val = plain(m[2])
    if (label === 'cruise call' || label === 'cruise calls') g.cruiseCalls = val
    else if (label === 'status') g.status = val.replace(/^—\s*/, '')
    else if (label === 'at a glance') { g.atAGlance = val; Object.assign(g, splitGlance(val)) }
    else if (label === 'freedom in the world 2026') g.freedom = val
    else if (label.startsWith('government')) g.government = val
    else if (label === 'economy') g.economy = val
    else if (label === 'a short timeline') g.timeline = val
    else if (label === 'people to know') g.people = val
    else if (label === 'people and culture' || label.startsWith('culture')) g.culture = g.culture ? `${g.culture} ${val}` : val
    else if (label === 'explore further') g.links = links(m[2])
  }
  guides.push(g)
}

guides.sort((a, b) => a.id.localeCompare(b.id))
const problems = guides.flatMap(countryProblems)
const flagsDir = new URL('../src/assets/art/flags/', import.meta.url)
for (const g of guides) if (!existsSync(new URL(`${g.id}.png`, flagsDir))) problems.push(`${g.id}: no flag file src/assets/art/flags/${g.id}.png`)
const covered = new Set(guides.flatMap((g) => g.ports.map((p) => p.id)))
for (const p of catalogue) if (!covered.has(p.id)) problems.push(`${p.id}: port has no country profile (country code ${p.countryCode})`)

writeFileSync(new URL('../server/Princess.Api/Content/country-guides.json', import.meta.url), '[\n' + guides.map((g) => JSON.stringify(g)).join(',\n') + '\n]\n')
console.log(`countryguides:gen wrote ${guides.length} country guides`)
if (unknown.length) console.error(`Profiles with no entry in scripts/countryCodes.ts (left out):\n  ${unknown.join('\n  ')}`)
if (problems.length) { console.error(`Gaps (the guides were still written, but fix the document):\n  ${problems.join('\n  ')}`); process.exitCode = 1 }
if (unknown.length) process.exitCode = 1
