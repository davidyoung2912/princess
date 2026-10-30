// Builds the rows of db/seed/reference/*.sql from the authored TypeScript fixtures (src/domain, src/api).
// `npm run db:seed:gen` writes the files; `npm run db:seed:check` proves the files on disk still match this source.
import { en } from '../src/i18n/en.ts'
import { CATEGORIES, SHIP, SHIP_ACCESSIBILITY, SHIP_HIGHLIGHTS, OTHER_SHIPS } from '../src/domain/ship.ts'
import { capacityOf, FARES, FARE_IDS, EARLY_CREDIT_DAYS, promotionsFor } from '../src/domain/fares.ts'
import { cabinsFor } from '../src/domain/cabins.ts'
import { MUSTER_STATIONS, PLACES, placeById } from '../src/domain/deck.ts'
import { itinerary, PORTS, SAILINGS, SHIP_HOME_ZONE, shipClockChanges } from '../src/domain/sailings.ts'
import { PORT_COORDS, PORT_GUIDES } from '../src/domain/ports.ts'
import { PORT_ENTRY } from '../src/domain/documents.ts'
import { PORT_CONTACTS, REQUEST_ITEMS, BAR_MENU } from '../src/domain/services.ts'
import { VENUES } from '../src/domain/dining.ts'
import { DIRECTORY } from '../src/domain/menus.ts'
import { MENU } from '../src/domain/orders.ts'
import { dayOf, EXCURSIONS, endMinutes, guestPrice, minAge } from '../src/domain/excursions.ts'
import { EVENTS } from '../src/domain/program.ts'
import { ADD_ONS, unitPrice, upgradesFrom, upgradePrice } from '../src/domain/packages.ts'
import { computeEntitlements } from '../src/domain/entitlements.ts'
import { INCLUDED_WITH_PREMIER, PHOTOGRAPHERS, PRICES, SPOTS } from '../src/domain/photos.ts'
import { CREW, DESK, deskTimes } from '../src/domain/postcruise.ts'
import { ADVISORS } from '../src/domain/ahead.ts'
import { CLUBS } from '../src/domain/family.ts'
import { FAQS } from '../src/domain/help.ts'
import { LEGAL } from '../src/domain/policy.ts'
import { DRILL_LANGUAGES } from '../src/domain/safety.ts'
import { HOTELS, MODES, PORT_FACTS, TRANSPORT, arrivalWindows } from '../src/domain/travel.ts'
import { CHECKLIST } from '../src/domain/checklist.ts'
import { NIGHT_ITEMS } from '../src/domain/disembark.ts'
import { buildPackingList } from '../src/domain/packing.ts'
import { addDays } from '../src/domain/timezones.ts'
import type { CategoryId } from '../src/domain/ship.ts'
import type { PackageId, Tier } from '../src/domain/personas.ts'

export type ColType = 'str' | 'int' | 'bit' | 'time' | 'date' | 'datetime' | 'json'
export type Cell = string | number | boolean | null | unknown[] | Record<string, unknown>
export interface Col { name: string; type: ColType }
export interface Table { file: string; name: string; cols: Col[]; key: string[]; rows: Cell[][] }

const t = (name: string, type: ColType): Col => ({ name, type })
const SHIP_ID = SHIP.id
const text = (key: string): string => (en as Record<string, string>)[key] ?? ''
const first = <T>(list: readonly T[]): T => list[0]

/** "15:00" -> "15:00:00"; the TIME type has no 24:00, so the end of the day is 23:59:59. */
const clock = (hhmm: string): string => (hhmm === '24:00' ? '23:59:59' : `${hhmm}:00`)
const deckOf = (label: string): number => Number(/Deck (\d+)/.exec(label)?.[1] ?? 0)
const hhmm = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const REFERENCE = SAILINGS.find((s) => s.reference)!

export function buildTables(): Table[] {
  const tables: Table[] = []
  const add = (file: string, name: string, key: string[], cols: Col[], rows: Cell[][]) => tables.push({ file, name, key, cols, rows })

  // ---------------------------------------------------------------- 01 ship
  const decks = [...new Set([...PLACES.map((p) => p.deck), ...CATEGORIES.flatMap((c) => cabinsFor('x', c.id).map((x) => x.deck))])].sort((a, b) => a - b)
  add('01-ship', 'ref.Ships', ['Id'],
    [t('Id', 'str'), t('Name', 'str'), t('Class', 'str'), t('Decks', 'int'), t('Tonnage', 'int'), t('Capacity', 'int'), t('HomeZone', 'str'), t('ProfileJson', 'json')],
    [[SHIP_ID, SHIP.name, SHIP.className, SHIP.decks, SHIP.tonnage, SHIP.guests, SHIP_HOME_ZONE,
      { ...SHIP, highlights: SHIP_HIGHLIGHTS, accessibility: SHIP_ACCESSIBILITY, otherShips: OTHER_SHIPS }]])

  add('01-ship', 'ref.Decks', ['ShipId', 'Number'],
    [t('ShipId', 'str'), t('Number', 'int'), t('Name', 'str'), t('Summary', 'str')],
    decks.map((n) => [SHIP_ID, n, `Deck ${n}`, PLACES.filter((p) => p.deck === n).map((p) => p.name).join(', ')]))

  add('01-ship', 'ref.CabinCategories', ['Id'],
    [t('Id', 'str'), t('Name', 'str'), t('IsSuite', 'bit'), t('Capacity', 'int'), t('SizeSqFt', 'int'), t('Description', 'str'), t('Features', 'json'), t('SortOrder', 'int')],
    CATEGORIES.map((c, i) => [c.id, c.name, !!c.suite, capacityOf(c.id), Number(/\d+/.exec(c.size)?.[0] ?? 0), c.summary,
      { code: c.code, size: c.size, view: c.view, fareRatio: c.ratio }, i + 1]))

  const stationId = (letter: string) => `station-${letter.toLowerCase()}`
  add('01-ship', 'ref.MusterStations', ['Id'],
    [t('Id', 'str'), t('ShipId', 'str'), t('Name', 'str'), t('Place', 'str'), t('Deck', 'int')],
    Object.values(MUSTER_STATIONS).map((m) => [stationId(m.letter), SHIP_ID, `Station ${m.letter}`, m.name, m.deck]))

  // A cabin's muster station is the one beside its elevator bank: A/B forward, C/D midship, E/F aft, port then starboard.
  const stationFor = (position: string, side: string) => stationId('ABCDEF'[(['forward', 'midship', 'aft'].indexOf(position)) * 2 + (side === 'port' ? 0 : 1)])
  const cabins = CATEGORIES.flatMap((c) => cabinsFor(first(SAILINGS).id, c.id as CategoryId).map((x) => [SHIP_ID, x.number, c.id, x.deck,
    x.position === 'forward' ? 'fwd' : x.position === 'midship' ? 'mid' : 'aft', x.side, x.accessible, false, stationFor(x.position, x.side)] as Cell[]))
  add('01-ship', 'ref.Cabins', ['ShipId', 'Number'],
    [t('ShipId', 'str'), t('Number', 'str'), t('CategoryId', 'str'), t('Deck', 'int'), t('Section', 'str'), t('Side', 'str'), t('Accessible', 'bit'), t('Connecting', 'bit'), t('MusterStationId', 'str')],
    cabins)

  // ---------------------------------------------------------------- 02 itinerary
  const countries: Record<string, string> = { fll: 'United States', sea: '', cozumel: 'Mexico', belize: 'Belize', roatan: 'Honduras' }
  const entry = (id: string) => PORT_ENTRY.find((e) => e.country.toLowerCase().includes(({ cozumel: 'cozumel', belize: 'belize', roatan: 'roat' } as Record<string, string>)[id] ?? '\0'))?.note ?? ''
  add('02-itinerary', 'ref.Ports', ['Id'],
    [t('Id', 'str'), t('Name', 'str'), t('Country', 'str'), t('TimeZone', 'str'), t('Tender', 'bit'), t('EntryNote', 'str'), t('Contacts', 'json')],
    [['sea', 'At sea', '', SHIP_HOME_ZONE, false, '', []],
      ...Object.values(PORTS).map((p) => [p.id, p.name, countries[p.id], p.zone, p.tender, entry(p.id), p.id in PORT_CONTACTS ? PORT_CONTACTS[p.id as keyof typeof PORT_CONTACTS] : []] as Cell[])])

  add('02-itinerary', 'ref.Sailings', ['Id'],
    [t('Id', 'str'), t('ShipId', 'str'), t('Departure', 'date'), t('Nights', 'int'), t('IsHoliday', 'bit'), t('IsReference', 'bit'), t('Title', 'str'), t('BookingOpen', 'bit')],
    SAILINGS.map((s) => [s.id, SHIP_ID, s.departure, 7, !!s.holiday, !!s.reference, `${s.holiday ? 'Holiday ' : ''}Western Caribbean, 7 nights from Fort Lauderdale, ${s.departure}`, true]))

  add('02-itinerary', 'ref.ItineraryDays', ['SailingId', 'Day'],
    [t('SailingId', 'str'), t('Day', 'int'), t('Date', 'date'), t('PortId', 'str'), t('ArriveLocal', 'time'), t('DepartLocal', 'time'), t('AllAboardLocal', 'time'), t('ClockChangeHours', 'int'), t('ClockChangeAtLocal', 'time')],
    SAILINGS.flatMap((s) => {
      const changes = shipClockChanges(s)
      const clockDays = [4, 7]
      return itinerary(s).map((d) => {
        const ci = clockDays.indexOf(d.day)
        return [s.id, d.day, d.date, d.port, d.arrive ? clock(d.arrive) : null, d.depart ? clock(d.depart) : null, d.allAboard ? clock(d.allAboard) : null,
          ci >= 0 ? changes[ci].hours : null, ci >= 0 ? '02:00:00' : null] as Cell[]
      })
    }))

  // ---------------------------------------------------------------- 03 dining
  const hoursOf = (id: string) => DIRECTORY.find((v) => v.id === id)?.hours
  const venueIds = [...new Set([...VENUES.map((v) => v.id), ...DIRECTORY.map((v) => v.id)])]
  add('03-dining', 'ref.Venues', ['Id'],
    [t('Id', 'str'), t('Kind', 'str'), t('Name', 'str'), t('Cuisine', 'str'), t('Deck', 'int'), t('DressCode', 'str'), t('Capacity', 'int'), t('Walkin', 'bit'), t('OpenFrom', 'time'), t('OpenTo', 'time'), t('CoverCents', 'int'), t('Description', 'str'), t('Hours', 'json')],
    venueIds.map((id) => {
      const v = VENUES.find((x) => x.id === id)
      const d = DIRECTORY.find((x) => x.id === id)
      const kind = v?.kind ?? (d!.price === 'specialty' ? 'specialty' : d!.price === 'casual' ? 'casual' : id === 'soleil' ? 'main' : 'casual')
      const hours = hoursOf(id)
      const spans = hours ? [...hours.sea, ...hours.port] : []
      const from = spans.length ? spans.map((s) => s[0]).sort()[0] : '00:00'
      const to = spans.length ? spans.map((s) => s[1]).sort().at(-1)! : '24:00'
      const description = [d?.blurb, v?.menu].filter(Boolean).join(' ')
      return [id, kind, v?.name ?? d!.name, v?.cuisine ?? '', deckOf(v?.deck ?? d!.deck), v?.dress ?? d!.dress, v && !v.walkIn ? 4 : 0, !!v?.walkIn || kind === 'casual' || id === 'soleil',
        clock(from), clock(to), v?.cover ?? 0, description, hours ?? {}] as Cell[]
    }))

  const dishId = (venue: string, name: string) => `${venue}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
  const menuRows: Cell[][] = [
    ...MENU.map((m) => [m.id, null, m.group, m.name, '', m.cents, [...m.contains], true, null, m.alcohol, m.packaged, [...m.on], m.substitute ?? null] as Cell[]),
    ...DIRECTORY.flatMap((v) => v.dishes.map((dish) => [dishId(v.id, dish.name), v.id, 'mains', dish.name, '', 0, [...dish.contains], false, null, false, false, [], null] as Cell[])),
  ]
  add('03-dining', 'ref.MenuItems', ['Id'],
    [t('Id', 'str'), t('VenueId', 'str'), t('MenuGroup', 'str'), t('Name', 'str'), t('Description', 'str'), t('PriceCents', 'int'), t('Dietary', 'json'), t('Orderable', 'bit'), t('Stock', 'int'), t('Alcohol', 'bit'), t('Packaged', 'bit'), t('OnMenus', 'json'), t('SubstituteId', 'str')],
    menuRows)

  add('03-dining', 'ref.MenuExtras', ['Id'],
    [t('Id', 'str'), t('ItemId', 'str'), t('Label', 'str'), t('Cents', 'int')],
    MENU.flatMap((m) => m.extras.map((e) => [`${m.id}-${e.id}`, m.id, e.label, e.cents] as Cell[])))

  add('03-dining', 'ref.Drinks', ['Id'],
    [t('Id', 'str'), t('Cents', 'int'), t('Alcohol', 'bit')],
    BAR_MENU.map((d) => [d.id, d.cents, d.alcohol]))

  // ---------------------------------------------------------------- 04 excursions
  add('04-excursions', 'ref.Excursions', ['Id'],
    [t('Id', 'str'), t('PortId', 'str'), t('Name', 'str'), t('Interest', 'str'), t('Activity', 'str'), t('AdultCents', 'int'), t('ChildCents', 'int'), t('MinAge', 'int'), t('DurationMin', 'int'), t('StartLocal', 'time'), t('BackByLocal', 'time'), t('Tender', 'bit'), t('Capacity', 'int'), t('Meeting', 'str'), t('Description', 'str'), t('Tags', 'json'), t('Rating', 'int'), t('Reviews', 'int')],
    EXCURSIONS.map((x) => [x.id, x.port, x.name, x.interests[0], x.activity, x.price, guestPrice(x, 0), minAge(x), Math.round(x.hours * 60), clock(x.start), clock(hhmm(endMinutes(x))), PORTS[x.port].tender, x.capacity, x.meeting, x.summary,
      [...x.interests, ...(x.family ? ['family'] : []), ...(x.wheelchair ? ['wheelchair'] : [])], Math.round(x.rating * 10), x.reviews]))

  add('04-excursions', 'ref.ExcursionDepartures', ['ExcursionId', 'SailingId', 'Day'],
    [t('ExcursionId', 'str'), t('SailingId', 'str'), t('Day', 'int'), t('SpotsTotal', 'int')],
    EXCURSIONS.flatMap((x) => SAILINGS.map((s) => [x.id, s.id, dayOf(s, x).day, x.capacity] as Cell[])))

  // ---------------------------------------------------------------- 05 programme
  add('05-programme', 'ref.Events', ['Id'],
    [t('Id', 'str'), t('Kind', 'str'), t('Title', 'str'), t('Place', 'str'), t('StartLocal', 'time'), t('DurationMin', 'int'), t('AgeGroup', 'str'), t('Interests', 'json'), t('Ticketed', 'bit'), t('Seats', 'int'), t('Deck', 'int'), t('ExtraCents', 'int'), t('AfterAllAboard', 'bit')],
    EVENTS.map((e) => [e.id, e.interest, e.title, e.placeId, clock(e.start), e.minutes, e.age, [e.interest], e.extra > 0, null, placeById(e.placeId)?.deck ?? null, e.extra, !!e.afterAllAboard]))

  add('05-programme', 'ref.EventDays', ['EventId', 'SailingId', 'Day'],
    [t('EventId', 'str'), t('SailingId', 'str'), t('Day', 'int'), t('StatusOverride', 'str')],
    EVENTS.flatMap((e) => SAILINGS.flatMap((s) => e.days.map((day) => [e.id, s.id, day, null] as Cell[]))))

  add('05-programme', 'ref.Clubs', ['Id'],
    [t('Id', 'str'), t('Name', 'str'), t('MinAge', 'int'), t('MaxAge', 'int'), t('Deck', 'int'), t('OpenFrom', 'time'), t('OpenTo', 'time')],
    CLUBS.map((c) => [c.id, c.name, c.minAge, c.maxAge, placeById(c.placeId)!.deck, clock(c.opens), clock(c.closes)]))

  add('05-programme', 'ref.ServiceItems', ['Id'],
    [t('Id', 'str'), t('Group', 'str'), t('EtaMin', 'int'), t('MaxQty', 'int')],
    REQUEST_ITEMS.map((r) => [r.id, r.group, r.etaMin, r.maxQty]))

  add('05-programme', 'ref.CrewMembers', ['Id'],
    [t('Id', 'str'), t('ShipId', 'str'), t('Name', 'str'), t('Role', 'str')],
    CREW.map((c) => [c.id, SHIP_ID, c.name, c.role]))

  add('05-programme', 'ref.DeskSlots', ['At'],
    [t('At', 'datetime'), t('Capacity', 'int')],
    SAILINGS.flatMap((s) => DESK.days.flatMap((day) => deskTimes().map((time) => [`${itinerary(s)[day - 1].date} ${time}:00`, 1] as Cell[]))))

  // ---------------------------------------------------------------- 06 pricing
  add('06-pricing', 'ref.Fares', ['Id'],
    [t('Id', 'str'), t('Name', 'str'), t('PerNightCents', 'int'), t('Tagline', 'str')],
    FARE_IDS.map((id) => [id, FARES[id].name, FARES[id].perNight, FARES[id].tagline]))

  const standardCredit = promotionsFor('interior', EARLY_CREDIT_DAYS)[0].creditCents
  const suiteCredit = promotionsFor('miniSuite', EARLY_CREDIT_DAYS)[0].creditCents
  add('06-pricing', 'ref.Promotions', ['Id'],
    [t('Id', 'str'), t('MinDaysOut', 'int'), t('CreditCentsStandard', 'int'), t('CreditCentsSuite', 'int')],
    [['earlyCredit', EARLY_CREDIT_DAYS, standardCredit, suiteCredit]])

  add('06-pricing', 'ref.Packages', ['Id'],
    [t('Id', 'str'), t('Name', 'str'), t('Unit', 'str'), t('BaseCents', 'int'), t('ChangeOn', 'date'), t('ChangesToCents', 'int'), t('Description', 'str')],
    (['plus', 'premier'] as const).map((id) => [id, FARES[id].name, 'personNight', FARES[id].perNight, null, null, FARES[id].tagline]))

  const refDate = (atDays: number) => addDays(REFERENCE.departure, -atDays)
  add('06-pricing', 'ref.AddOns', ['Id'],
    [t('Id', 'str'), t('Name', 'str'), t('Unit', 'str'), t('BaseCents', 'int'), t('ChangeOn', 'date'), t('ChangesToCents', 'int'), t('Description', 'str'), t('ChangeAtDays', 'int'), t('ChangeShare', 'int'), t('MinAge', 'int')],
    Object.values(ADD_ONS).map((a) => [a.id, a.name, a.unit, a.base, a.change.share === 0 ? null : refDate(a.change.atDays), a.change.share === 0 ? null : unitPrice(a.base, a.change, a.change.atDays - 1), a.blurb,
      a.change.share === 0 ? null : a.change.atDays, a.change.share === 0 ? null : Math.round(a.change.share * 10_000), a.minAge]))

  // Upgrades are stored from "no package" (the key is the target); plus -> premier is the difference, worked out in code.
  add('06-pricing', 'ref.PackageUpgrades', ['ToPackageId'],
    [t('ToPackageId', 'str'), t('PriceCents', 'int'), t('ChangeOn', 'date'), t('ChangesToCents', 'int'), t('ChangeAtDays', 'int'), t('ChangeShare', 'int')],
    upgradesFrom('none').map((u) => [u.to, u.base, refDate(u.change.atDays), upgradePrice(u, u.change.atDays - 1), u.change.atDays, Math.round(u.change.share * 10_000)]))

  const entitlementRow = (kind: 'tier' | 'package', id: string, tier: Tier, pkg: PackageId): Cell[] => {
    const e = computeEntitlements({ tier, package: pkg, sanctuary: false })
    return [kind, id, e.drinkCapUsd, e.wifiDevices, e.specialtyMeals, e.excursionCreditUsd, pkg === 'premier', e.perks.includes('freeLaundry') ? 1 : 0, e.perks.includes('priorityEmbarkation')]
  }
  add('06-pricing', 'ref.Entitlements', ['SourceKind', 'SourceId'],
    [t('SourceKind', 'str'), t('SourceId', 'str'), t('DrinkCapUsd', 'int'), t('WifiDevices', 'int'), t('SpecialtyMeals', 'int'), t('ExcursionCreditUsd', 'int'), t('PhotoIncluded', 'bit'), t('LaundryBags', 'int'), t('Priority', 'bit')],
    [...(['none', 'gold', 'ruby', 'platinum', 'elite'] as const).map((id) => entitlementRow('tier', id, id, 'none')),
      ...(['none', 'plus', 'premier'] as const).map((id) => entitlementRow('package', id, 'none', id))])

  // ---------------------------------------------------------------- 07 photos and people
  add('07-photos-people', 'ref.PhotoCatalogue', ['Id'],
    [t('Id', 'str'), t('Day', 'int'), t('Place', 'str'), t('Caption', 'str'), t('Thumb', 'str')],
    SPOTS.map((s) => [s.id, s.day, s.venue, s.title, '']))

  add('07-photos-people', 'ref.PhotographerSlots', ['Day', 'Place', 'StartLocal'],
    [t('Day', 'int'), t('Place', 'str'), t('StartLocal', 'time')],
    PHOTOGRAPHERS.map((p) => [p.day, p.placeId, clock(p.time)]))

  add('07-photos-people', 'ref.PhotoOptions', ['Id'],
    [t('Id', 'str'), t('Cents', 'int'), t('Count', 'int'), t('Description', 'str')],
    [['each', PRICES.each, 1, 'One photo'], ['five', PRICES.five, 5, 'A pack of five photos'], ['all', PRICES.all, 0, `Every photo (the Premier package includes ${INCLUDED_WITH_PREMIER})`]])

  add('07-photos-people', 'ref.Advisors', ['Id'],
    [t('Id', 'str'), t('Name', 'str'), t('Agency', 'str'), t('Region', 'str'), t('Languages', 'json'), t('Speciality', 'str'), t('Hours', 'str')],
    ADVISORS.map((a) => [a.id, a.name, a.agency, a.region, [...a.languages], a.speciality, a.hours]))

  // ---------------------------------------------------------------- 08 content
  add('08-content', 'ref.Faqs', ['Id'],
    [t('Id', 'str'), t('Area', 'str'), t('Title', 'str'), t('Body', 'str'), t('Locale', 'str'), t('SortOrder', 'int')],
    FAQS.map((f, i) => [f.id, f.topic, f.question, f.answer, 'en', i + 1]))

  add('08-content', 'ref.HelpTopics', ['Id'],
    [t('Id', 'str'), t('Area', 'str'), t('Title', 'str'), t('Body', 'str'), t('Locale', 'str'), t('SortOrder', 'int')],
    DRILL_LANGUAGES.map((l, i) => [`muster-${l.code}`, 'safety', `Muster drill in ${l.name}`, l.lines.join('\n'), l.code, i + 1]))

  const blocks: Cell[][] = []
  const block = (id: string, area: string, title: string, body: string) => blocks.push([id, area, title, body, 'en', blocks.length + 1])
  block('ship-intro', 'ship', SHIP.name, SHIP.intro)
  SHIP_HIGHLIGHTS.forEach((h, i) => block(`ship-highlight-${i + 1}`, 'ship', h.title, h.body))
  SHIP_ACCESSIBILITY.forEach((a, i) => block(`ship-access-${i + 1}`, 'ship-access', 'Accessibility', a))
  for (const guide of Object.values(PORT_GUIDES)) {
    const { id, short, ...rest } = guide
    block(`port-${id}`, 'port', short, JSON.stringify({ ...rest, coords: PORT_COORDS[id] }))
  }
  Object.entries(PORT_FACTS).forEach(([k, v]) => block(`port-facts-${k}`, 'travel', k, v))
  MODES.forEach((m) => block(`travel-mode-${m}`, 'travel', TRANSPORT[m].name, JSON.stringify(TRANSPORT[m])))
  HOTELS.forEach((h) => block(`travel-hotel-${h.id}`, 'travel', h.name, JSON.stringify(h)))
  add('08-content', 'ref.ContentBlocks', ['Id'],
    [t('Id', 'str'), t('Area', 'str'), t('Title', 'str'), t('Body', 'str'), t('Locale', 'str'), t('SortOrder', 'int')],
    blocks)

  add('08-content', 'ref.LegalDocs', ['Id', 'Version'],
    [t('Id', 'str'), t('Version', 'int'), t('Title', 'str'), t('Statement', 'str'), t('Body', 'json')],
    LEGAL.map((l) => [l.id, Number(l.version.replace('-', '')), l.title, l.statement, [...l.body]]))

  // ---------------------------------------------------------------- 09 lists
  add('09-lists', 'ref.TravelWindows', ['Id'],
    [t('Id', 'str'), t('StartLocal', 'time'), t('EndLocal', 'time'), t('Priority', 'bit')],
    arrivalWindows(true).map((w) => [`w-${w.start.replace(':', '')}`, clock(w.start), clock(w.end), w.start === '10:30']))

  add('09-lists', 'ref.NightChecklistItems', ['Id'],
    [t('Id', 'str'), t('Label', 'str'), t('SortOrder', 'int')],
    NIGHT_ITEMS.map((n, i) => [n.id, text(`night.item.${n.id}`), i + 1]))

  add('09-lists', 'ref.ChecklistItems', ['Id'],
    [t('Id', 'str'), t('Phase', 'str'), t('DueDaysBefore', 'int'), t('Label', 'str')],
    CHECKLIST.map((c) => [c.id, `d${c.daysBefore}`, c.daysBefore, text(`plan.check.item.${c.id}`)]))

  const everything = { departure: REFERENCE.departure, nights: 7, tours: EXCURSIONS.map((x) => x.id), ages: [1, 15, 40], needs: ['cpap', 'oxygen', 'hearing', 'mobility'] as never[], tender: true, elegantNights: 2 }
  const nothing = { departure: '2027-01-17', nights: 7, tours: [] as string[], ages: [40], needs: [] as never[], tender: false, elegantNights: 0 }
  const always = new Set(buildPackingList(nothing).map((i) => i.id))
  add('09-lists', 'ref.PackingItems', ['Id'],
    [t('Id', 'str'), t('Label', 'str'), t('Rule', 'json')],
    buildPackingList(everything).map((i) => [i.id, i.label, { group: i.group, why: i.why, always: always.has(i.id) }]))

  return tables
}

// ------------------------------------------------------------------ rendering

/** A string as an ASCII-only T-SQL expression: anything outside ASCII becomes NCHAR(n), so no console or file code page can damage it. */
export function nstr(value: string): string {
  const parts: string[] = []
  let run = ''
  const flush = () => { if (run) { parts.push(`N'${run.replace(/'/g, "''")}'`); run = '' } }
  for (const ch of value) {
    for (let i = 0; i < ch.length; i++) {
      const code = ch.charCodeAt(i)
      if (code >= 32 && code < 127) run += ch[i]
      else { flush(); parts.push(`NCHAR(${code})`) }
    }
  }
  flush()
  if (parts.length === 0) return "N''"
  const joined = parts.join(' + ')
  // A concatenation of literals is typed NVARCHAR(4000); the cast keeps long text whole.
  return value.length > 1500 ? `CAST(${parts[0]} AS NVARCHAR(MAX))${parts.length > 1 ? ' + ' + parts.slice(1).join(' + ') : ''}` : joined
}

export function literal(cell: Cell, type: ColType): string {
  if (cell === null || cell === undefined) {
    return type === 'time' ? 'CAST(NULL AS TIME(0))' : type === 'date' ? 'CAST(NULL AS DATE)' : type === 'datetime' ? 'CAST(NULL AS DATETIME2(0))' : 'NULL'
  }
  switch (type) {
    case 'str': return nstr(String(cell))
    case 'json': return nstr(typeof cell === 'string' ? cell : JSON.stringify(cell))
    case 'int': return String(Number(cell))
    case 'bit': return cell ? '1' : '0'
    case 'time': return `CAST('${cell}' AS TIME(0))`
    case 'date': return `CAST('${cell}' AS DATE)`
    case 'datetime': return `CAST('${cell}' AS DATETIME2(0))`
  }
}

const q = (name: string) => `[${name}]`

export function renderTable(table: Table): string {
  const cols = table.cols
  const set = cols.filter((c) => !table.key.includes(c.name))
  const rows = table.rows.map((row) => `  (${row.map((cell, i) => literal(cell, cols[i].type)).join(', ')})`).join(',\n')
  const on = table.key.map((k) => `t.${q(k)} = s.${q(k)}`).join(' AND ')
  const lines = [
    `-- ${table.name}: ${table.rows.length} rows`,
    `MERGE ${table.name} AS t`,
    `USING (VALUES\n${rows}\n) AS s (${cols.map((c) => q(c.name)).join(', ')})`,
    `ON ${on}`,
  ]
  if (set.length) lines.push(`WHEN MATCHED THEN UPDATE SET ${set.map((c) => `t.${q(c.name)} = s.${q(c.name)}`).join(', ')}`)
  lines.push(`WHEN NOT MATCHED THEN INSERT (${cols.map((c) => q(c.name)).join(', ')}) VALUES (${cols.map((c) => `s.${q(c.name)}`).join(', ')});`, 'GO', '')
  return lines.join('\n')
}

export const FILE_TITLES: Record<string, string> = {
  '01-ship': 'Ship, decks, stateroom types, muster stations and sample staterooms',
  '02-itinerary': 'Ports, the eight sailings and their day-by-day itineraries',
  '03-dining': 'Venues, menu items, menu extras and bar drinks',
  '04-excursions': 'Shore excursions and their departures on each sailing',
  '05-programme': 'Events, clubs, service requests, crew and Future Cruise desk slots',
  '06-pricing': 'Fares, promotions, packages, add-ons, upgrades and entitlements',
  '07-photos-people': 'Photo spots, photographer slots, photo prices and travel advisors',
  '08-content': 'FAQs, help topics, content blocks and legal documents',
  '09-lists': 'Arrival windows, checklists and the packing list',
}

export function renderFile(file: string, tables: readonly Table[]): string {
  const mine = tables.filter((x) => x.file === file)
  return [
    '/*',
    `  Reference data: ${FILE_TITLES[file]}.`,
    '  GENERATED by `npm run db:seed:gen` from the TypeScript fixtures in src/. Do not edit by hand: change the source and regenerate.',
    '  Idempotent: each table is a MERGE on its key, so re-running updates rows in place and adds missing ones. It never deletes.',
    '  Run after db/01-schema.sql:  sqlcmd -S <server> -d <db> -b -i <this file>   (plain ASCII, no code page needed)',
    '*/',
    'SET NOCOUNT ON;',
    'SET QUOTED_IDENTIFIER ON;',
    'GO',
    '',
    ...mine.map(renderTable),
  ].join('\n')
}
