// Catalogue source types, validation, sailing materialisation and SQL rendering (docs/catalogue-plan.md, sections 3 and 4).
// Pure TypeScript, no file or database access, so it can be tested in a node environment.
export type Depth = 'browse' | 'aboard'
export type DataStatus = 'served' | 'sample' | 'verified'
export type PortTier = 'A' | 'B' | 'C'

export interface CatalogueRegion { id: string; name: string }
export interface CatalogueHighlight { title: string; body: string }
export interface CatalogueShip {
  id: string; name: string; class: string; grossTonnage: number; decks: number; guests: number; crew: number
  lengthFt?: number; beamFt?: number; homeZone?: string
  staterooms?: number; entered?: number; intro: string; highlights: CatalogueHighlight[]; depth: Depth
}
export interface CataloguePort {
  id: string; name: string; country?: string; countryCode: string; region: string; zone: string; lat: number; lon: number
  currency: string; languages: string[]; tier: PortTier; tender?: boolean; artId?: string
}
export interface PatternDay { day: number; port: string | 'sea'; arrive?: string; depart?: string; allAboard?: string; clockChange?: number }
export interface CataloguePattern { id: string; name: string; region: string; nights: number; startPort: string; endPort: string; description: string; days: PatternDay[] }
export interface SailingLegRef { pattern: string }
export interface CatalogueSailing { id: string; ship: string; departure: string; title: string; legs: SailingLegRef[]; dataStatus: DataStatus; holiday?: boolean }
export interface CatalogueCategory { id: string; ship: string; name: string; isSuite?: boolean; capacity: number; sizeSqFt: number; description: string; sortOrder: number }
export interface CatalogueFare { ship: string; category: string; perNightCents: number }

export interface CatalogueSource {
  regions: CatalogueRegion[]; ships: CatalogueShip[]; ports: CataloguePort[]; patterns: CataloguePattern[]
  sailings: CatalogueSailing[]; fares: CatalogueFare[]; categories?: CatalogueCategory[]
}

/** Sun Princess sailings seeded from the TypeScript fixtures (`db/seed/reference/02-itinerary.sql`). They stay as they are. */
export const LEGACY_SAILINGS: readonly { id: string; departure: string }[] = [
  '2026-11-08', '2026-11-22', '2026-12-06', '2026-12-27', '2027-01-17', '2027-02-07', '2027-02-28', '2027-03-21', '2027-11-07', '2027-11-21', '2027-12-05', '2028-01-09',
].map((d) => ({ id: `sun-${d}`, departure: d }))
/** The fixtures' route: the pattern the legacy sailings are backfilled to. */
export const LEGACY_PATTERN = 'carib-west-a'
export const LEGACY_SHIP = 'sun-princess'
/** The six Sun Princess categories already in `01-ship.sql`. */
export const LEGACY_CATEGORIES = ['interior', 'oceanview', 'balcony', 'miniSuite', 'sanctuaryMiniSuite', 'signatureSuite']

const ISO = /^\d{4}-\d{2}-\d{2}$/
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
const CATEGORY_ID = /^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function dup(ids: string[], what: string, errors: string[], pattern = ID) {
  const seen = new Set<string>()
  for (const id of ids) {
    if (!pattern.test(id)) errors.push(`${what} id "${id}" is not a lower-case slug`)
    if (seen.has(id)) errors.push(`duplicate ${what} id "${id}"`)
    seen.add(id)
  }
  return seen
}

/** The short ship name used in sailing ids: `sun-princess` gives `sun`. */
export const shipPrefix = (shipId: string) => shipId.replace(/-princess$/, '')

export function nightsOf(c: CatalogueSource, s: CatalogueSailing): number {
  const byId = new Map(c.patterns.map((p) => [p.id, p]))
  return s.legs.reduce((n, l) => n + (byId.get(l.pattern)?.nights ?? 0), 0)
}

/** The id a new sailing must have: `<ship>-<yyyy-mm-dd>-<nights>`. */
export const sailingIdFor = (shipId: string, departure: string, nights: number) => `${shipPrefix(shipId)}-${departure}-${nights}`

/** Returns a list of problems; an empty list means the source is consistent. */
export function validateCatalogue(c: CatalogueSource): string[] {
  const errors: string[] = []
  const categories = c.categories ?? []
  const regions = dup(c.regions.map((r) => r.id), 'region', errors)
  const ships = dup(c.ships.map((s) => s.id), 'ship', errors)
  const ports = dup(c.ports.map((p) => p.id), 'port', errors)
  const patterns = dup(c.patterns.map((p) => p.id), 'pattern', errors)
  const categoryIds = dup(categories.map((k) => k.id), 'category', errors, CATEGORY_ID)
  dup(c.sailings.map((s) => s.id), 'sailing', errors)
  const patternById = new Map(c.patterns.map((p) => [p.id, p]))

  for (const s of c.ships) {
    if (!s.name || !s.class || !s.intro) errors.push(`ship ${s.id}: name, class and intro are required`)
    if (!(s.depth === 'browse' || s.depth === 'aboard')) errors.push(`ship ${s.id}: depth must be browse or aboard`)
    if (s.grossTonnage <= 0 || s.decks <= 0 || s.guests <= 0 || s.crew <= 0) errors.push(`ship ${s.id}: tonnage, decks, guests and crew must be positive`)
  }
  for (const k of categories) {
    if (!ships.has(k.ship)) errors.push(`category ${k.id}: unknown ship "${k.ship}"`)
    if (k.ship === LEGACY_SHIP) errors.push(`category ${k.id}: Sun Princess categories live in 01-ship.sql`)
    if (k.capacity <= 0) errors.push(`category ${k.id}: capacity must be positive`)
  }
  for (const p of c.ports) {
    if (!regions.has(p.region)) errors.push(`port ${p.id}: unknown region "${p.region}"`)
    if (!p.country) errors.push(`port ${p.id}: country name is required`)
    if (!/^[A-Z]{2}$/.test(p.countryCode)) errors.push(`port ${p.id}: country code must be two capitals`)
    if (p.lat < -90 || p.lat > 90 || p.lon < -180 || p.lon > 180) errors.push(`port ${p.id}: coordinates out of range`)
    if (!(p.tier === 'A' || p.tier === 'B' || p.tier === 'C')) errors.push(`port ${p.id}: tier must be A, B or C`)
    if (!/^[A-Z]{3}$/.test(p.currency)) errors.push(`port ${p.id}: currency must be a three-letter code`)
    if (!p.zone.includes('/')) errors.push(`port ${p.id}: zone "${p.zone}" is not an IANA zone name`)
    else {
      try { new Intl.DateTimeFormat('en-US', { timeZone: p.zone }) } catch { errors.push(`port ${p.id}: unknown time zone "${p.zone}"`) }
    }
  }
  for (const pat of c.patterns) {
    if (!regions.has(pat.region)) errors.push(`pattern ${pat.id}: unknown region "${pat.region}"`)
    if (!ports.has(pat.startPort)) errors.push(`pattern ${pat.id}: unknown start port "${pat.startPort}"`)
    if (!ports.has(pat.endPort)) errors.push(`pattern ${pat.id}: unknown end port "${pat.endPort}"`)
    if (pat.days.length !== pat.nights + 1) errors.push(`pattern ${pat.id}: ${pat.nights} nights needs ${pat.nights + 1} days, has ${pat.days.length}`)
    pat.days.forEach((d, i) => {
      if (d.day !== i + 1) errors.push(`pattern ${pat.id}: days must be consecutive from 1 (day ${d.day} at position ${i + 1})`)
      if (d.port !== 'sea' && !ports.has(d.port)) errors.push(`pattern ${pat.id} day ${d.day}: unknown port "${d.port}"`)
      for (const t of [d.arrive, d.depart, d.allAboard]) if (t !== undefined && !TIME.test(t)) errors.push(`pattern ${pat.id} day ${d.day}: bad time "${t}"`)
    })
    if (pat.days.length > 0) {
      if (pat.days[0].port !== pat.startPort) errors.push(`pattern ${pat.id}: day 1 is ${pat.days[0].port}, not the start port ${pat.startPort}`)
      if (pat.days[pat.days.length - 1].port !== pat.endPort) errors.push(`pattern ${pat.id}: last day is ${pat.days[pat.days.length - 1].port}, not the end port ${pat.endPort}`)
    }
  }
  if (ships.has(LEGACY_SHIP) && !patterns.has(LEGACY_PATTERN)) errors.push(`pattern ${LEGACY_PATTERN} is required: the seeded Sun Princess sailings are backfilled to it`)
  const byDeparture = new Set<string>()
  for (const s of c.sailings) {
    if (!ships.has(s.ship)) errors.push(`sailing ${s.id}: unknown ship "${s.ship}"`)
    if (!ISO.test(s.departure) || Number.isNaN(Date.parse(s.departure))) errors.push(`sailing ${s.id}: bad departure "${s.departure}"`)
    if (s.legs.length === 0) errors.push(`sailing ${s.id}: needs at least one leg`)
    let known = true
    for (const l of s.legs) if (!patterns.has(l.pattern)) { errors.push(`sailing ${s.id}: unknown pattern "${l.pattern}"`); known = false }
    if (known) {
      s.legs.forEach((l, i) => {
        const next = s.legs[i + 1]
        if (next && patternById.get(l.pattern)!.endPort !== patternById.get(next.pattern)!.startPort) errors.push(`sailing ${s.id}: leg ${i + 1} ends in ${patternById.get(l.pattern)!.endPort} but leg ${i + 2} starts in ${patternById.get(next.pattern)!.startPort}`)
      })
      const nights = nightsOf(c, s)
      const want = sailingIdFor(s.ship, s.departure, nights)
      if (s.id !== want) errors.push(`sailing ${s.id}: id must be ${want}`)
      const key = `${s.ship}|${s.departure}|${nights}`
      if (byDeparture.has(key)) errors.push(`sailing ${s.id}: ship ${s.ship} already sails on ${s.departure} for ${nights} nights`)
      byDeparture.add(key)
      if (s.ship === LEGACY_SHIP && nights === 7 && LEGACY_SAILINGS.some((l) => l.departure === s.departure)) errors.push(`sailing ${s.id}: ${s.departure} is a seeded Sun Princess sailing (sun-${s.departure}); leave it out`)
    }
  }
  for (const f of c.fares) {
    if (!ships.has(f.ship)) errors.push(`fare ${f.category}: unknown ship "${f.ship}"`)
    else if (f.ship === LEGACY_SHIP ? !LEGACY_CATEGORIES.includes(f.category) : !categories.some((k) => k.ship === f.ship && k.id === f.category)) errors.push(`fare ${f.ship}/${f.category}: no such category for the ship`)
    if (!Number.isInteger(f.perNightCents) || f.perNightCents <= 0) errors.push(`fare ${f.ship}/${f.category}: price must be a positive whole number of cents`)
  }
  void categoryIds
  return errors
}

// ---- Materialising a sailing -------------------------------------------------------------------------------------

export interface SailingDay { day: number; date: string; port: string; arrive: string | null; depart: string | null; allAboard: string | null; clockChange: number | null }
export interface SailingLegRow { legNo: number; pattern: string; startDay: number }
export interface MaterialSailing { nights: number; legs: SailingLegRow[]; days: SailingDay[]; startPort: string; endPort: string; region: string }

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)

/** UTC offset in minutes of an IANA zone at midday UTC on a date. */
export function zoneOffsetMinutes(zone: string, iso: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date(`${iso}T12:00:00Z`))
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = /GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(name)
  if (!m || !m[1]) return 0
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

/**
 * Expands a sailing into its day rows. Legs join on a shared turnaround day: the arriving leg's last day and the next leg's first day
 * are one calendar day, which keeps the arrival time of the first and the departure and all-aboard times of the second.
 * Ship clock changes are worked out from the real zone offsets on each date: the clock moves at 02:00 on the day the ship reaches a port in a
 * different zone, and (as the seeded Western Caribbean route does) one day early when the zone change is the way into a leg's end port.
 */
export function materialiseSailing(c: CatalogueSource, s: CatalogueSailing): MaterialSailing {
  const patterns = new Map(c.patterns.map((p) => [p.id, p]))
  const ports = new Map(c.ports.map((p) => [p.id, p]))
  const days: SailingDay[] = []
  const legs: SailingLegRow[] = []
  let startDay = 1
  s.legs.forEach((l, i) => {
    const pat = patterns.get(l.pattern)!
    legs.push({ legNo: i + 1, pattern: l.pattern, startDay })
    pat.days.forEach((d, j) => {
      const n = startDay + j
      const row: SailingDay = { day: n, date: addDays(s.departure, n - 1), port: d.port, arrive: d.arrive ?? null, depart: d.depart ?? null, allAboard: d.allAboard ?? null, clockChange: d.clockChange ?? null }
      if (j === 0 && i > 0) {
        const prev = days[days.length - 1]
        prev.depart = row.depart
        prev.allAboard = row.allAboard
        if (row.clockChange !== null) prev.clockChange = row.clockChange
      } else days.push(row)
    })
    startDay += pat.nights
  })
  const legEnds = new Set(legs.map((_, i) => (i + 1 < legs.length ? legs[i + 1].startDay : startDay)))   // the day each leg reaches its end port
  let offset: number | null = null
  for (const d of days) {
    let next: number | null = offset
    if (d.port !== 'sea') next = zoneOffsetMinutes(ports.get(d.port)!.zone, d.date)
    else if (legEnds.has(d.day + 1) && offset !== null) {
      const home = days[d.day]
      if (home.port !== 'sea') next = zoneOffsetMinutes(ports.get(home.port)!.zone, home.date)
    }
    if (offset !== null && next !== null && next !== offset && d.clockChange === null && (next - offset) % 60 === 0) d.clockChange = (next - offset) / 60
    offset = next
  }
  const first = patterns.get(s.legs[0].pattern)!
  const end = patterns.get(s.legs[s.legs.length - 1].pattern)!
  return { nights: startDay - 1, legs, days, startPort: first.startPort, endPort: end.endPort, region: first.region }
}

/** The dinner dress code for a sailing day: casual on embark and disembark days; elegant on nights 2 and 7 of each week (night 2 only on 5 and 6 night cruises). */
export function dressCode(nights: number, day: number): 'casual' | 'smart' | 'elegant' {
  if (day <= 1 || day > nights) return 'casual'
  if (nights < 5) return 'smart'
  if (nights < 7) return day === 2 ? 'elegant' : 'smart'
  const n = day % 7
  return n === 2 || n === 0 ? 'elegant' : 'smart'
}

/** Price per person per night for a category on a sailing. Today one flat price per ship and category; X0c may refine by season. */
export function fareFor(c: CatalogueSource, shipId: string): CatalogueFare[] {
  return c.fares.filter((f) => f.ship === shipId)
}

// ---- SQL ---------------------------------------------------------------------------------------------------------

/** A T-SQL string literal in plain ASCII: characters above 126 become NCHAR(n) pieces, as the other generated seeds do. */
export function q(s: string): string {
  let out = ''
  let open = false
  const begin = () => { if (!open) { out += (out ? " + N'" : "N'"); open = true } }
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (code > 126) {
      if (open) { out += "'"; open = false }
      out += (out ? ' + ' : '') + `NCHAR(${code})`
      continue
    }
    begin()
    out += ch === "'" ? "''" : ch
  }
  if (open) out += "'"
  return out === '' ? "N''" : out
}
const t = (v: string | null | undefined) => (v ? `CAST('${v}:00' AS TIME(0))` : 'CAST(NULL AS TIME(0))')
const n = (v: number | null | undefined) => (v === null || v === undefined ? 'NULL' : String(v))
const bit = (v: boolean | undefined) => (v ? '1' : '0')

const CHUNK = 400

/** One idempotent MERGE per chunk of rows. `update` lists the columns a match rewrites; the others are only written on insert. */
function merge(table: string, keys: string[], cols: string[], rows: string[][], update: string[], comment: string): string[] {
  if (rows.length === 0) return []
  const out: string[] = []
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK)
    const header = i === 0 ? `-- ${table}: ${comment}` : `-- ${table}: continued`
    const on = keys.map((k) => `t.[${k}] = s.[${k}]`).join(' AND ')
    const matched = update.length ? `WHEN MATCHED THEN UPDATE SET ${update.map((u) => `t.[${u}] = s.[${u}]`).join(', ')}\n` : ''
    out.push(
      `${header}\nMERGE ${table} AS t\nUSING (VALUES\n${part.map((r) => `  (${r.join(', ')})`).join(',\n')}\n) AS s (${cols.map((x) => `[${x}]`).join(', ')})\nON ${on}\n${matched}WHEN NOT MATCHED THEN INSERT (${cols.map((x) => `[${x}]`).join(', ')}) VALUES (${cols.map((x) => `s.[${x}]`).join(', ')});\nGO\n`,
    )
  }
  return out
}

/** Pre-quoted SQL rows of the other ships' decks, muster stations and sample staterooms (built by `ship-cabin-rows.ts`, which reads the client's cabin generator). */
export interface ShipCabinRows { decks: string[][]; stations: string[][]; cabins: string[][] }
export const NO_SHIP_CABINS: ShipCabinRows = { decks: [], stations: [], cabins: [] }
/** Pre-quoted SQL rows of the other ships' dining rooms, menu items (room service and dishes) and menu extras (built by `ship-venue-data.ts`). */
export interface ShipVenueRows { venues: string[][]; menu: string[][]; extras: string[][] }
export const NO_SHIP_VENUES: ShipVenueRows = { venues: [], menu: [], extras: [] }

const GUIDE: Record<PortTier, string> = { A: 'full', B: 'short', C: 'link' }

function profileJson(s: CatalogueShip): string {
  return JSON.stringify({
    id: s.id, name: s.name, className: s.class, entered: s.entered ?? null, tonnage: s.grossTonnage,
    length: s.lengthFt ? `${s.lengthFt.toLocaleString('en-US')} ft` : '', guests: s.guests, crew: s.crew, staterooms: s.staterooms ?? null, decks: s.decks,
    intro: s.intro, highlights: s.highlights,
  })
}

/** Renders the generated SQL: the catalogue tables, the new columns, the materialised sailings and the backfill of the seeded ones. */
export function renderCatalogueSql(c: CatalogueSource, own: ShipCabinRows = NO_SHIP_CABINS, dining: ShipVenueRows = NO_SHIP_VENUES): string {
  const categories = c.categories ?? []
  const material = c.sailings.map((s) => ({ s, m: materialiseSailing(c, s) }))
  const out: string[] = [
    '/*',
    '  GENERATED by `npm run catalogue:gen` from db/seed/catalogue/*.json. Do not edit by hand: change the JSON and regenerate.',
    `  ${c.regions.length} regions, ${c.ships.length} ships, ${c.ports.length} ports, ${c.patterns.length} patterns, ${c.sailings.length} sailings.`,
    '  Idempotent MERGEs; it never deletes. Run after the other reference seeds (db/seed/reference/run-all.sql does): it reads ref.Ships, ref.Ports,',
    '  ref.CabinCategories and ref.Sailings rows that 01-ship.sql and 02-itinerary.sql create, and only fills the catalogue columns on those rows.',
    '*/',
    'SET NOCOUNT ON;',
    'SET QUOTED_IDENTIFIER ON;',
    'GO',
    '',
  ]
  out.push(...merge('ref.Regions', ['Id'], ['Id', 'Name', 'SortOrder'], c.regions.map((r, i) => [q(r.id), q(r.name), String(i + 1)]), ['Name', 'SortOrder'], `${c.regions.length} rows`))
  out.push(
    ...merge(
      'ref.Ships', ['Id'],
      ['Id', 'Name', 'Class', 'Decks', 'Tonnage', 'Capacity', 'HomeZone', 'ProfileJson', 'LengthFt', 'BeamFt', 'Crew', 'Staterooms', 'Entered', 'Intro', 'Depth'],
      c.ships.map((s) => [q(s.id), q(s.name), q(s.class), String(s.decks), String(s.grossTonnage), String(s.guests), q(s.homeZone ?? 'America/New_York'), `CAST(${q(profileJson(s))} AS NVARCHAR(MAX))`, n(s.lengthFt), n(s.beamFt), String(s.crew), n(s.staterooms), n(s.entered), q(s.intro), q(s.depth)]),
      ['LengthFt', 'BeamFt', 'Crew', 'Staterooms', 'Entered', 'Intro', 'Depth'], `${c.ships.length} rows (a seeded ship keeps its profile; only the catalogue columns are filled)`,
    ),
  )
  out.push(
    ...merge(
      'ref.CabinCategories', ['Id'], ['Id', 'Name', 'IsSuite', 'Capacity', 'SizeSqFt', 'Description', 'Features', 'SortOrder', 'ShipId'],
      categories.map((k) => [q(k.id), q(k.name), bit(k.isSuite), String(k.capacity), String(k.sizeSqFt), q(k.description), q('{}'), String(k.sortOrder), q(k.ship)]),
      ['Name', 'IsSuite', 'Capacity', 'SizeSqFt', 'Description', 'SortOrder', 'ShipId'], `${categories.length} stateroom categories for the browse ships`,
    ),
  )
  out.push(
    ...merge('ref.Decks', ['ShipId', 'Number'], ['ShipId', 'Number', 'Name', 'Summary'], own.decks, ['Name'], `${own.decks.length} decks of the other ships`),
    ...merge('ref.MusterStations', ['Id'], ['Id', 'ShipId', 'Name', 'Place', 'Deck'], own.stations, ['ShipId', 'Name', 'Place', 'Deck'], `${own.stations.length} sample muster stations of the other ships`),
    ...merge('ref.Cabins', ['ShipId', 'Number'], ['ShipId', 'Number', 'CategoryId', 'Deck', 'Section', 'Side', 'Accessible', 'Connecting', 'MusterStationId'], own.cabins, ['CategoryId', 'Deck', 'Section', 'Side', 'Accessible', 'Connecting', 'MusterStationId'], `${own.cabins.length} sample staterooms of the other ships (generated, deterministic; not the real deck plan)`),
  )
  out.push(
    ...merge('ref.Venues', ['Id'], ['Id', 'Kind', 'Name', 'Cuisine', 'Deck', 'DressCode', 'Capacity', 'Walkin', 'OpenFrom', 'OpenTo', 'CoverCents', 'Description', 'Hours', 'ShipId'], dining.venues, ['Kind', 'Name', 'Cuisine', 'Deck', 'DressCode', 'Capacity', 'Walkin', 'OpenFrom', 'OpenTo', 'CoverCents', 'Description', 'Hours', 'ShipId'], `${dining.venues.length} sample dining rooms of the other ships`),
    ...merge('ref.MenuItems', ['Id'], ['Id', 'VenueId', 'MenuGroup', 'Name', 'Description', 'PriceCents', 'Dietary', 'Orderable', 'Stock', 'Alcohol', 'Packaged', 'OnMenus', 'SubstituteId', 'ShipId'], dining.menu, ['VenueId', 'MenuGroup', 'Name', 'Description', 'PriceCents', 'Dietary', 'Orderable', 'Alcohol', 'Packaged', 'OnMenus', 'SubstituteId', 'ShipId'], `${dining.menu.length} sample room-service items and dishes of the other ships`),
    ...merge('ref.MenuExtras', ['Id'], ['Id', 'ItemId', 'Label', 'Cents'], dining.extras, ['ItemId', 'Label', 'Cents'], `${dining.extras.length} menu extras of the other ships`),
  )
  out.push(
    ...merge(
      'ref.Ports', ['Id'], ['Id', 'Name', 'Country', 'TimeZone', 'Tender', 'RegionId', 'CountryCode', 'Lat', 'Lon', 'Currency', 'Languages', 'Tier', 'GuideStatus', 'ArtId'],
      c.ports.map((p) => [q(p.id), q(p.name), q(p.country ?? ''), q(p.zone), bit(p.tender), q(p.region), q(p.countryCode), p.lat.toFixed(4), p.lon.toFixed(4), q(p.currency), q(JSON.stringify(p.languages)), q(p.tier), q(GUIDE[p.tier]), p.artId ? q(p.artId) : 'NULL']),
      ['RegionId', 'CountryCode', 'Lat', 'Lon', 'Currency', 'Languages', 'Tier', 'GuideStatus', 'ArtId'], `${c.ports.length} rows (a seeded port keeps its name, entry note and contacts)`,
    ),
  )
  out.push(
    ...merge('ref.ItineraryPatterns', ['Id'], ['Id', 'Name', 'RegionId', 'Nights', 'StartPortId', 'EndPortId', 'Description'], c.patterns.map((p) => [q(p.id), q(p.name), q(p.region), String(p.nights), q(p.startPort), q(p.endPort), q(p.description)]), ['Name', 'RegionId', 'Nights', 'StartPortId', 'EndPortId', 'Description'], `${c.patterns.length} rows`),
  )
  const patternDays = c.patterns.flatMap((p) => p.days.map((d) => [q(p.id), String(d.day), q(d.port), t(d.arrive), t(d.depart), t(d.allAboard), n(d.clockChange), d.clockChange === undefined ? t(undefined) : t('02:00')]))
  out.push(...merge('ref.ItineraryPatternDays', ['PatternId', 'Day'], ['PatternId', 'Day', 'PortId', 'ArriveLocal', 'DepartLocal', 'AllAboardLocal', 'ClockChangeHours', 'ClockChangeAtLocal'], patternDays, ['PortId', 'ArriveLocal', 'DepartLocal', 'AllAboardLocal', 'ClockChangeHours', 'ClockChangeAtLocal'], `${patternDays.length} rows`))
  out.push(
    ...merge(
      'ref.Sailings', ['Id'], ['Id', 'ShipId', 'Departure', 'Nights', 'IsHoliday', 'IsReference', 'Title', 'BookingOpen', 'PatternId', 'StartPortId', 'EndPortId', 'LegCount', 'RegionId', 'DataStatus'],
      material.map(({ s, m }) => [q(s.id), q(s.ship), `CAST('${s.departure}' AS DATE)`, String(m.nights), bit(s.holiday), '0', q(s.title), '0', q(s.legs[0].pattern), q(m.startPort), q(m.endPort), String(m.legs.length), q(m.region), q(s.dataStatus)]),
      ['ShipId', 'Departure', 'Nights', 'IsHoliday', 'Title', 'PatternId', 'StartPortId', 'EndPortId', 'LegCount', 'RegionId', 'DataStatus'], `${material.length} sample sailings (not open for booking until X0c prices them)`,
    ),
  )
  const dayRows = material.flatMap(({ s, m }) => m.days.map((d) => [q(s.id), String(d.day), `CAST('${d.date}' AS DATE)`, q(d.port), t(d.arrive), t(d.depart), t(d.allAboard), n(d.clockChange), d.clockChange === null ? t(undefined) : t('02:00')]))
  out.push(...merge('ref.ItineraryDays', ['SailingId', 'Day'], ['SailingId', 'Day', 'Date', 'PortId', 'ArriveLocal', 'DepartLocal', 'AllAboardLocal', 'ClockChangeHours', 'ClockChangeAtLocal'], dayRows, ['Date', 'PortId', 'ArriveLocal', 'DepartLocal', 'AllAboardLocal', 'ClockChangeHours', 'ClockChangeAtLocal'], `${dayRows.length} rows`))
  const legRows = material.flatMap(({ s, m }) => m.legs.map((l) => [q(s.id), String(l.legNo), q(l.pattern), String(l.startDay)]))
  out.push(...merge('ref.SailingLegs', ['SailingId', 'LegNo'], ['SailingId', 'LegNo', 'PatternId', 'StartDay'], legRows, ['PatternId', 'StartDay'], `${legRows.length} rows`))
  const dressRows = material.flatMap(({ s, m }) => m.days.map((d) => [q(s.id), String(d.day), q(dressCode(m.nights, d.day))]))
  out.push(...merge('ref.DressNights', ['SailingId', 'Day'], ['SailingId', 'Day', 'Code'], dressRows, ['Code'], `${dressRows.length} rows`))
  const fareRows = material.flatMap(({ s }) => fareFor(c, s.ship).map((f) => [q(s.id), q(f.category), String(f.perNightCents)]))
  out.push(...merge('ref.SailingFares', ['SailingId', 'CategoryId'], ['SailingId', 'CategoryId', 'PerNightCents'], fareRows, ['PerNightCents'], `${fareRows.length} rows`))

  const ids = material.map(({ s }) => q(s.id))
  out.push(
    '-- Backfill: the Sun Princess sailings seeded by 02-itinerary.sql all follow the Western A route from Fort Lauderdale.',
    `UPDATE s SET s.PatternId = ${q(LEGACY_PATTERN)}, s.StartPortId = N'fll', s.EndPortId = N'fll', s.LegCount = 1, s.RegionId = N'caribbean', s.DataStatus = 'served'`,
    `FROM ref.Sailings s WHERE s.ShipId = ${q(LEGACY_SHIP)} AND s.PatternId IS NULL${ids.length ? ` AND s.Id NOT IN (${ids.join(', ')})` : ''};`,
    `INSERT INTO ref.SailingLegs (SailingId, LegNo, PatternId, StartDay)`,
    `SELECT s.Id, 1, s.PatternId, 1 FROM ref.Sailings s WHERE s.ShipId = ${q(LEGACY_SHIP)} AND s.PatternId = ${q(LEGACY_PATTERN)} AND s.DataStatus = 'served'`,
    `  AND NOT EXISTS (SELECT 1 FROM ref.SailingLegs l WHERE l.SailingId = s.Id);`,
    'GO',
    '',
  )
  return out.join('\n')
}
