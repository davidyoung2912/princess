// The sample dining rooms, directory (dishes tagged for allergens and diets) and room-service menu of the ships other than Sun Princess (AB3).
// One authored copy: `npm run shipvenues:gen` writes it to server/Princess.Api/Content/ship-venues.json (embedded, served from
// GET /reference/ships/{id}/venues) and `npm run catalogue:gen` seeds the same rows into ref.Venues and ref.MenuItems.
// Concept sample data in the same honest way as Sun's (docs/content-verification.md): plausible rooms in the right class, not the real ship's list.
import '../src/testing/setup.ts'
import { DIRECTORY, type DirectoryVenue, type Dish } from '../src/domain/menus.ts'
import { MENU, type MenuItem } from '../src/domain/orders.ts'
import { VENUES as SUN_VENUES, type Venue } from '../src/domain/dining.ts'
import { q, shipPrefix, type CatalogueSource, type ShipVenueRows } from './catalogue.ts'

export interface ShipVenueBundle {
  shipId: string
  venues: Venue[]
  directory: DirectoryVenue[]
  menu: MenuItem[]
  deliveryZones: string[]
}

const d = (name: string, ...contains: Dish['contains'][number][]): Dish => ({ name, contains })

/** Sun's directory entry for a room every ship has (the buffet, the pool grill, the café, Alfredo's, Crown Grill, Sabatini's), moved to this ship's venue id and deck. */
function shared(prefix: string, sunId: string, deck: string): DirectoryVenue {
  const base = DIRECTORY.find((v) => v.id === sunId)
  if (!base) throw new Error(`no Sun directory entry ${sunId}`)
  return { ...base, id: `${prefix}-${sunId}`, deck, hours: { sea: base.hours.sea.map((h) => [...h] as [string, string]), port: base.hours.port.map((h) => [...h] as [string, string]) }, dishes: base.dishes.map((x) => ({ ...x, contains: [...x.contains] })) }
}

interface ShipSpec {
  shipId: string
  /** Main dining rooms: id, name, deck text, blurb, dishes. */
  mains: readonly { key: string; name: string; deck: string; blurb: string; cuisine: string; menu: string; dishes: Dish[] }[]
  decks: Record<'crown' | 'sabatini' | 'alfredo' | 'eatery' | 'lido' | 'intl-cafe', string>
  /** The room-service dish only this ship has. */
  signature: { key: string; name: string; group: MenuItem['group']; cents: number; contains: Dish['contains'] }
}

const SPECS: readonly ShipSpec[] = [
  {
    shipId: 'sky-princess',
    mains: [
      { key: 'allegro', name: 'Allegro Dining Room', deck: 'Deck 6 aft', cuisine: 'Traditional three-course dinner', blurb: 'Anytime dining on the lower level: reserve a table or walk in.',
        menu: 'Seared sea bass, braised short rib, a vegetarian tasting plate, and a different dessert every night.',
        dishes: [d('Seared sea bass', 'fish'), d('Braised short rib', 'meat'), d('Vegetarian tasting plate', 'dairy', 'nuts'), d('Roasted cauliflower steak'), d('Caesar salad', 'egg', 'dairy', 'fish', 'gluten'), d('Seasonal fruit plate')] },
      { key: 'concerto', name: 'Concerto Dining Room', deck: 'Deck 7 aft', cuisine: 'Traditional three-course dinner', blurb: 'Anytime dining on the upper level. Same menu as Allegro.',
        menu: 'Seared sea bass, braised short rib, a vegetarian tasting plate, and a different dessert every night.',
        dishes: [d('Seared sea bass', 'fish'), d('Braised short rib', 'meat'), d('Vegetarian tasting plate', 'dairy', 'nuts'), d('Roasted cauliflower steak'), d('Pea and mint soup', 'dairy'), d('Lemon tart', 'dairy', 'egg', 'gluten')] },
    ],
    decks: { crown: 'Deck 7 aft', sabatini: 'Deck 7 midship', alfredo: 'Deck 16 aft', eatery: 'Deck 16 midship', lido: 'Deck 16 midship', 'intl-cafe': 'Deck 5 midship' },
    signature: { key: 'pasta', name: 'Penne pomodoro', group: 'mains', cents: 950, contains: ['gluten', 'dairy'] },
  },
  {
    shipId: 'sapphire-princess',
    mains: [
      { key: 'santa-fe', name: 'Santa Fe Dining Room', deck: 'Deck 5 aft', cuisine: 'Traditional three-course dinner with a southwestern night', blurb: 'Anytime dining on the lower level: reserve a table or walk in.',
        menu: 'Chile-rubbed salmon, slow-cooked pork carnitas, a vegetarian enchilada, and a different dessert every night.',
        dishes: [d('Chile-rubbed salmon', 'fish'), d('Pork carnitas', 'pork', 'meat'), d('Vegetarian enchilada', 'dairy', 'gluten'), d('Roasted corn soup', 'dairy'), d('Garden salad'), d('Churros with chocolate', 'gluten', 'egg', 'dairy')] },
      { key: 'vivaldi', name: 'Vivaldi Dining Room', deck: 'Deck 6 aft', cuisine: 'Traditional three-course dinner', blurb: 'Anytime dining on the upper level. Same menu as Santa Fe.',
        menu: 'Seared sea bass, roast chicken with herbs, a vegetable wellington, and a different dessert every night.',
        dishes: [d('Seared sea bass', 'fish'), d('Roast chicken with herbs', 'meat'), d('Vegetable wellington', 'gluten', 'dairy'), d('French onion soup', 'dairy', 'gluten'), d('Shrimp cocktail', 'shellfish'), d('Chocolate lava cake', 'dairy', 'egg', 'gluten', 'nuts')] },
    ],
    decks: { crown: 'Deck 6 midship', sabatini: 'Deck 6 aft', alfredo: 'Deck 12 aft', eatery: 'Deck 12 midship', lido: 'Deck 12 midship', 'intl-cafe': 'Deck 5 midship' },
    signature: { key: 'quesadilla', name: 'Chicken quesadilla', group: 'mains', cents: 950, contains: ['meat', 'dairy', 'gluten'] },
  },
]

/** Places the crew deliver to on deck: ids every ship's plan has (Sun's `dome` is its own). */
const ZONES = ['lido-pool', 'promenade', 'sea-view', 'piazza']

/** The room-service menu of a ship: Sun's items under the ship's own ids (`sky-cheeseburger`), plus the ship's own dish. */
function menuOf(prefix: string, sig: ShipSpec['signature']): MenuItem[] {
  const own = (id: string) => `${prefix}-${id}`
  const items = MENU.map((m) => ({ ...m, id: own(m.id), contains: [...m.contains], on: [...m.on], extras: m.extras.map((e) => ({ ...e })), ...(m.substitute ? { substitute: own(m.substitute) } : {}) }))
  const at = items.findIndex((m) => m.id === own('caesar')) + 1
  items.splice(at, 0, { id: own(sig.key), name: sig.name, group: sig.group, cents: sig.cents, alcohol: false, packaged: false, contains: [...sig.contains], on: ['delivery', 'room'], extras: [] })
  return items
}

function bundle(spec: ShipSpec): ShipVenueBundle {
  const prefix = shipPrefix(spec.shipId)
  const id = (key: string) => `${prefix}-${key}`
  const crown = shared(prefix, 'crown', spec.decks.crown)
  const sabatini = shared(prefix, 'sabatini', spec.decks.sabatini)
  const alfredo = shared(prefix, 'alfredo', spec.decks.alfredo)
  const rooms = spec.mains.map((m): DirectoryVenue => ({ id: id(m.key), name: m.name, deck: m.deck, placeId: m.key, blurb: m.blurb, dress: 'smart', price: 'included',
    hours: { sea: [['17:30', '21:30']], port: [['17:30', '21:30']] }, dishes: m.dishes }))
  const directory: DirectoryVenue[] = [
    ...rooms, shared(prefix, 'eatery', spec.decks.eatery), shared(prefix, 'lido', spec.decks.lido), shared(prefix, 'intl-cafe', spec.decks['intl-cafe']), alfredo, crown, sabatini,
  ]
  const sunVenue = (sunId: string) => {
    const v = SUN_VENUES.find((x) => x.id === sunId)
    if (!v) throw new Error(`no Sun venue ${sunId}`)
    return v
  }
  const venues: Venue[] = [
    ...spec.mains.map((m): Venue => ({ id: id(m.key), name: m.name, kind: 'main', deck: m.deck, cuisine: m.cuisine, cover: 0, dress: 'smart', menu: m.menu })),
    { ...sunVenue('crown'), id: id('crown'), deck: spec.decks.crown },
    { ...sunVenue('sabatini'), id: id('sabatini'), deck: spec.decks.sabatini },
    { ...sunVenue('alfredo'), id: id('alfredo'), deck: spec.decks.alfredo },
  ]
  return { shipId: spec.shipId, venues, directory, menu: menuOf(prefix, spec.signature), deliveryZones: [...ZONES] }
}

/** The dining of every ship except Sun Princess's. */
export function shipVenueBundles(): ShipVenueBundle[] { return SPECS.map(bundle) }

/** The JSON the server embeds: one key per ship, one line each so a change reads as a diff. */
export function shipVenuesFileText(): string {
  const all = shipVenueBundles()
  return '{\n' + all.map((b) => `${JSON.stringify(b.shipId)}: ${JSON.stringify({ venues: b.venues, directory: b.directory, menu: b.menu, deliveryZones: b.deliveryZones })}`).join(',\n') + '\n}\n'
}

const bit = (v: boolean) => (v ? '1' : '0')
const clock = (t: string) => (t === '24:00' ? '23:59:00' : `${t}:00`)
const deckNumber = (text: string) => Number(/Deck (\d+)/.exec(text)?.[1] ?? 0)

/** Pre-quoted SQL rows for ref.Venues, ref.MenuItems and ref.MenuExtras of the other ships (as `ship-cabin-rows.ts` does for cabins). */
export function shipVenueRows(c: CatalogueSource): ShipVenueRows {
  const known = new Set(c.ships.map((s) => s.id))
  const venues: string[][] = []
  const menu: string[][] = []
  const extras: string[][] = []
  const dishId = (venue: string, name: string) => `${venue}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`.slice(0, 40).replace(/-$/, "")   // ref.MenuItems.Id is NVARCHAR(40)
  for (const b of shipVenueBundles().filter((x) => known.has(x.shipId))) {
    for (const v of b.directory) {
      const room = b.venues.find((x) => x.id === v.id)
      const kind = room?.kind ?? (v.price === 'specialty' ? 'specialty' : 'casual')
      const spans = [...v.hours.sea, ...v.hours.port]
      const from = spans.map((s) => s[0]).sort()[0]
      const to = spans.map((s) => s[1]).sort().at(-1)!
      const description = [v.blurb, room?.menu].filter(Boolean).join(' ')
      venues.push([q(v.id), q(kind), q(room?.name ?? v.name), q(room?.cuisine ?? ''), String(deckNumber(room?.deck ?? v.deck)), q(room?.dress ?? v.dress), String(room && !room.walkIn ? 4 : 0),
        bit(!!room?.walkIn || kind === 'casual' || !room), q(clock(from)), q(clock(to)), String(room?.cover ?? 0), q(description), `CAST(${q(JSON.stringify(v.hours))} AS NVARCHAR(MAX))`, q(b.shipId)])
    }
    for (const m of b.menu) {
      menu.push([q(m.id), 'NULL', q(m.group), q(m.name), q(''), String(m.cents), `CAST(${q(JSON.stringify(m.contains))} AS NVARCHAR(MAX))`, '1', 'NULL', bit(m.alcohol), bit(m.packaged), `CAST(${q(JSON.stringify(m.on))} AS NVARCHAR(MAX))`, m.substitute ? q(m.substitute) : 'NULL', q(b.shipId)])
      for (const e of m.extras) extras.push([q(`${m.id}-${e.id}`), q(m.id), q(e.label), String(e.cents)])
    }
    for (const v of b.directory) {
      for (const dish of v.dishes) menu.push([q(dishId(v.id, dish.name)), q(v.id), q('mains'), q(dish.name), q(''), '0', `CAST(${q(JSON.stringify(dish.contains))} AS NVARCHAR(MAX))`, '0', 'NULL', '0', '0', `CAST(N'[]' AS NVARCHAR(MAX))`, 'NULL', q(b.shipId)])
    }
  }
  return { venues, menu, extras }
}
