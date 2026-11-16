// The Explorer content of each ship (docs/explorer-harmony-plan.md): the venues of the six Explorers with their hours, the events that run at them and the menus of the
// restaurants. One authored copy: `npm run shipexplorer:gen` writes it to server/Princess.Api/Content/ship-explorer.json (embedded, served through
// GET /bookings/{number}/onboard/explorer/...). `src/domain/explorer/shipExplorer.test.ts` fails when the file is stale or breaks a rule.
//
// Phase 1 carries the dining rooms of all three ships, converted from the directory the app already has. The other Explorers and the events and menus arrive in their own
// phases; their lists are empty here and the server answers them with empty lists.
import '../src/testing/setup.ts'
import { DIRECTORY, type DirectoryVenue } from '../src/domain/menus.ts'
import { VENUES as SUN_VENUES, type Venue } from '../src/domain/dining.ts'
import type { ExplorerKind, HoursRule } from '../src/domain/explorer/types.ts'
import type { TemplateDayKind } from '../src/domain/explorer/dayMapping.ts'
import { shipVenueBundles } from './ship-venue-data.ts'

export const SUN_SHIP_ID = 'sun-princess'

export interface ExplorerVenueRow {
  id: string
  explorer: ExplorerKind
  kind: string
  title: string
  short: string
  long: string
  placeId: string
  deckLabel: string
  hours: HoursRule[]
  cover?: number
  minAge?: number
  bookable: 'none' | 'dining' | 'spa'
  order: number
  features: string[]
  accessibility: string[]
}

export interface ExplorerEventRow {
  id: string
  venueId: string
  when: string[]
  start: string
  minutes: number
  title: string
  detail: string
  age: 'all' | 'kids' | 'teens' | 'adults'
  interest: string
  extra: number
  afterAllAboard?: boolean
  capacity?: number
}

export interface MealCourseRow { name: string; dishes: { name: string; contains: string[]; note?: string }[] }

export interface MealMenuRow {
  venueId: string
  meal: 'breakfast' | 'brunch' | 'lunch' | 'tea' | 'dinner' | 'allDay'
  from: string
  to: string
  /** 1-based day of the ship's `menuTemplate` this menu belongs to; 0 is every day. */
  templateDay: number
  title: string
  theme?: string
  formal?: boolean
  courses: MealCourseRow[]
}

export interface ShipExplorerRow {
  /** What kind of day each day of the authored 7-day week is (docs/princess-restuarants.md): the server maps any sailing onto it. */
  menuTemplate: TemplateDayKind[]
  venues: ExplorerVenueRow[]
  events: ExplorerEventRow[]
  menus: MealMenuRow[]
}

/** The doc's week: embarkation, a sea day (formal), two ports, a sea day, a port, the last night. */
export const MENU_TEMPLATE: TemplateDayKind[] = ['embark', 'sea', 'port', 'port', 'sea', 'port', 'last']

const hoursOf = (v: DirectoryVenue): HoursRule[] => [
  { kind: 'fixed', when: ['sea'], windows: v.hours.sea.map((w) => [w[0], w[1]] as const) },
  { kind: 'fixed', when: ['night'], windows: v.hours.port.map((w) => [w[0], w[1]] as const) },
]

const KIND_TITLE: Record<string, string> = { main: 'Main dining room', specialty: 'Specialty restaurant', casual: 'Casual dining' }

function diningVenue(d: DirectoryVenue, room: Venue | undefined, order: number): ExplorerVenueRow {
  const kind = room?.kind ?? (/Dining Room/.test(d.name) ? 'main' : d.price === 'included' ? 'casual' : d.price)
  const cover = room && room.cover > 0 ? room.cover : undefined
  return {
    id: d.id, explorer: 'dining', kind, title: d.name, short: d.blurb,
    long: [d.blurb, room?.cuisine ? `${room.cuisine}.` : '', room?.menu ? `On the menu: ${room.menu}` : ''].filter(Boolean).join(' '),
    placeId: d.placeId, deckLabel: d.deck, hours: hoursOf(d),
    ...(cover !== undefined ? { cover } : {}),
    bookable: room && !room.walkIn && kind !== 'casual' ? 'dining' : 'none', order,
    features: [KIND_TITLE[kind] ?? kind, `Dress: ${d.dress}`], accessibility: [],
  }
}

function diningOf(directory: readonly DirectoryVenue[], rooms: readonly Venue[]): ExplorerVenueRow[] {
  return directory.map((d, i) => diningVenue(d, rooms.find((r) => r.id === d.id), i + 1))
}

/** The Explorer content of every ship, Sun Princess first. */
export function shipExplorerRows(): Record<string, ShipExplorerRow> {
  const out: Record<string, ShipExplorerRow> = {
    [SUN_SHIP_ID]: { menuTemplate: MENU_TEMPLATE, venues: diningOf(DIRECTORY, SUN_VENUES), events: [], menus: [] },
  }
  for (const b of shipVenueBundles()) out[b.shipId] = { menuTemplate: MENU_TEMPLATE, venues: diningOf(b.directory, b.venues), events: [], menus: [] }
  return out
}

/** The JSON the server embeds: one key per ship, one line per venue, event and menu so a change reads as a diff. */
export function shipExplorerFileText(): string {
  const all = shipExplorerRows()
  const lines = (rows: readonly unknown[]) => (rows.length === 0 ? '[]' : '[\n' + rows.map((r) => '    ' + JSON.stringify(r)).join(',\n') + '\n  ]')
  const ship = (id: string) => `${JSON.stringify(id)}: {\n  "menuTemplate": ${JSON.stringify(all[id].menuTemplate)},\n  "venues": ${lines(all[id].venues)},\n  "events": ${lines(all[id].events)},\n  "menus": ${lines(all[id].menus)}\n}`
  return '{\n' + Object.keys(all).map(ship).join(',\n') + '\n}\n'
}
