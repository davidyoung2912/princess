// Detail fields for the Explorer content (docs/explorer-harmony-plan.md, Phase 12): an event's performer, series, access, dress and arrival note, and a venue's access, family facilities
// and children's menu. They are worked out from what each row already says (its venue kind, title, interest, cost and capacity) so one rule covers all three ships, and nothing here
// names a person. The values are authored concept content for review, like the rest of the Explorer content: check them against the ship's own information before real use.
import type { ExplorerEventRow, ExplorerVenueRow } from './ship-explorer-data.ts'
import { eventCopy } from './event-copy.ts'
import { flagsOf, isNas, marksOf, type MenuDish } from './ship-explorer-diets.ts'

type VenueFacts = Pick<ExplorerVenueRow, 'explorer' | 'kind' | 'title'>

/** The codes an event's `access` may hold, the same ones `src/domain/eventAccess.ts` uses. */
export const ACCESS_CODES = ['captions', 'hearingLoop', 'wheelchairSeating', 'stepFreeRoute', 'quietSeating', 'lowLight'] as const

/** Who performs, only where the title already says so. */
const performerOf = (e: ExplorerEventRow): string | undefined => {
  const t = e.title
  const band = /resident band ([A-Z][\w]+)/.exec(t)
  if (band) return `Resident band ${band[1]}`
  if (/Cirque Éloize/.test(t)) return 'Cirque Éloize'
  if (/^Production show/.test(t)) return 'The Princess cast and orchestra'
  if (/Magic parlour/.test(t)) return 'Magic Castle magicians'
  if (/headline guest|guest illusionist/i.test(t)) return 'Guest illusionist and mentalist'
  if (/string quartet/i.test(t)) return 'String quartet'
  if (/string trio/i.test(t)) return 'String trio'
  if (/violin and cello duo/i.test(t)) return 'Violin and cello duo'
  if (/harp and flute/i.test(t)) return 'Harp and flute duo'
  if (/jazz trio/i.test(t)) return 'Jazz trio'
  if (/piano/i.test(t) && e.interest === 'music') return 'Resident pianist'
  if (/acoustic guitar/i.test(t)) return 'Guitarist and vocalist'
  if (/Irish duo/i.test(t)) return 'Irish duo'
  if (/comedian/i.test(t)) return 'Comedian and vocalist'
  if (/Wake Show|game show|Deal or No Deal/i.test(t)) return 'The Princess Live! host'
  return undefined
}

/** A short name for the events that belong together (every showing of one show, every round of one tournament), found from the title. */
const seriesOf = (e: ExplorerEventRow): string | undefined => {
  const t = e.title
  const show = /^Production show: ([^,]+)/.exec(t)
  if (show) return show[1]
  if (/Magic parlour/.test(t)) return 'Magic parlour at Spellbound'
  if (/Cirque Éloize/.test(t)) return 'Cirque Éloize at The Dome'
  if (/Movies Under the Stars/i.test(t)) return 'Movies Under the Stars'
  if (/slot tournament/i.test(t)) return 'Slot tournaments'
  if (/trivia/i.test(t)) return 'Trivia'
  return undefined
}

const SHOW_ACCESS = ['captions', 'hearingLoop', 'wheelchairSeating', 'stepFreeRoute']

/** What the venue offers: its kind says whether it is a stage, a deck, a pool or a room. */
const accessOf = (e: ExplorerEventRow, v: VenueFacts): string[] => {
  if (v.kind === 'show') return e.interest === 'shows' ? SHOW_ACCESS : ['hearingLoop', 'wheelchairSeating', 'stepFreeRoute']
  if (v.kind === 'studio') return ['captions', 'wheelchairSeating', 'stepFreeRoute']
  if (v.kind === 'quiet') return ['quietSeating', 'lowLight', 'stepFreeRoute']
  if (v.kind === 'pool' || v.kind === 'court') return []
  if (/Movies Under the Stars/i.test(e.title)) return ['captions', 'wheelchairSeating', 'stepFreeRoute']
  if (v.explorer === 'activities' && e.interest === 'learning') return ['hearingLoop', 'wheelchairSeating', 'stepFreeRoute']
  return ['stepFreeRoute']
}

const FORMAL = /formal|gala|champagne waterfall|captain’s welcome/i

const dressOf = (e: ExplorerEventRow, v: VenueFacts): string | undefined => {
  if (FORMAL.test(e.title)) return 'Formal or elegant evening wear is welcome. Smart casual is fine.'
  if (v.explorer === 'dining') return v.kind === 'bar' || v.kind === 'casual' ? 'Casual.' : 'Smart casual: no swimwear or bare feet.'
  if (v.explorer === 'spa') return 'A robe and slippers are provided. Please do not wear jewellery to a treatment.'
  if (v.explorer === 'exercise') return v.kind === 'pool' ? 'Swimwear.' : 'Sports clothing and closed shoes.'
  if (e.interest === 'wellness') return 'Comfortable clothes you can move in.'
  if (v.kind === 'casino') return 'Smart casual. No swimwear.'
  if (e.title.includes('Spellbound') || v.title.includes('Spellbound')) return 'Smart casual.'
  return undefined
}

const arriveOf = (e: ExplorerEventRow, v: VenueFacts): string | undefined => {
  if (v.explorer === 'spa') return 'Arrive 15 minutes early to check in and change.'
  if (e.capacity !== undefined && e.extra > 0) return 'Arrive 10 minutes early. Your place may be given to someone waiting if you are late.'
  if (e.capacity !== undefined) return 'Arrive 10 minutes early: places are limited and seats are not saved.'
  if (/early showing|first$|late showing|second$/i.test(e.title)) return 'Doors open 30 minutes before the show. Come early for the best seats.'
  if (v.kind === 'show') return 'Doors open 30 minutes before the show.'
  return undefined
}

export function detailEvent(e: ExplorerEventRow, v: VenueFacts): ExplorerEventRow {
  const performer = performerOf(e)
  const series = seriesOf(e)
  const access = accessOf(e, v)
  const dress = dressOf(e, v)
  const arrive = arriveOf(e, v)
  return { ...e, ...(performer ? { performer } : {}), ...(series ? { series } : {}), ...(access.length > 0 ? { access } : {}), ...(dress ? { dress } : {}), ...(arrive ? { arrive } : {}) }
}

/** The events of a ship, the same events with their detail fields; the order is kept. */
export function detailEvents(events: readonly ExplorerEventRow[], venues: readonly ExplorerVenueRow[]): ExplorerEventRow[] {
  const byId = new Map(venues.map((v) => [v.id, v]))
  return events.map((e) => { const v = byId.get(e.venueId); return describe(v ? detailEvent(e, v) : e) })
}

/** An event whose `detail` only says where it is ("At The Piazza. Places are limited.") gets what it is, in a sentence or two, and keeps the notes about cost and places. */
function describe(e: ExplorerEventRow): ExplorerEventRow {
  if (!/^At /.test(e.detail)) return e
  const about = eventCopy(e.title)
  if (!about) return e
  const notes = e.detail.replace(/^At .*?\.(?:\s|$)/, '').trim()
  return { ...e, detail: notes ? `${about} ${notes}` : about }
}

const STEP_FREE = 'Step-free entrance'

/** A venue's access notes. Dining rooms say how a wheelchair or a guest who needs help is looked after. */
const venueAccess = (v: ExplorerVenueRow): string[] => {
  const base = [STEP_FREE]
  switch (v.explorer) {
    case 'dining': return [...base, 'Space for wheelchairs and mobility scooters at the tables', 'Large-print menus on request', 'Tell the host if you need a table close to the entrance']
    case 'entertainment': return v.kind === 'show' || v.kind === 'studio' ? [...base, 'Wheelchair spaces and companion seats', 'Hearing loop in the main seating'] : [...base, 'Wheelchair-friendly seating']
    case 'spa': return [...base, 'Accessible treatment rooms: ask when you book', 'Seated changing area on request']
    case 'exercise': return v.kind === 'pool' ? ['Pool hoist or ramp: ask the pool attendant', 'Staff will help with any equipment'] : [...base, 'Staff will help with any equipment']
    case 'shopping': return [...base, 'Wide aisles for wheelchairs and scooters']
    default: return [...base, 'Seats and space for wheelchairs']
  }
}

/** What a family finds at a restaurant: the children's menu, seating for little ones and what is done for babies. Bars have none. */
const venueFamily = (v: ExplorerVenueRow): string[] => {
  if (v.explorer !== 'dining' || v.kind === 'bar') return []
  const tail = ['High chairs and booster seats: ask the host, no need to book them', 'Babies are welcome. Staff will warm bottles and baby food on request, and a stroller can be parked by the entrance']
  if (v.kind === 'casual') return ['Children’s portions and a children’s menu on request', ...tail]
  if (v.kind === 'specialty') return ['Children’s menu on request, with smaller portions of favourite dishes', ...tail, 'Early evening tables suit young children best']
  return ['A children’s menu is served at every meal', ...tail]
}

/** A short children's menu for every restaurant that has family facilities. */
const KIDS_DISHES: ReadonlyArray<[name: string, contains: string[]]> = [
  ['Chicken tenders and fries', ['egg', 'gluten', 'meat']], ['Macaroni and cheese', ['dairy', 'gluten']], ['Mini cheese pizza', ['dairy', 'gluten']], ['Grilled fish with rice', ['fish']],
  ['Buttered pasta', ['dairy', 'gluten']], ['Fresh fruit plate', []], ['Vanilla ice cream', ['dairy', 'egg']],
]
/** The same marks and heads-ups as every other menu, worked out from what each dish contains. */
export const KIDS_MENU: MenuDish[] = KIDS_DISHES.map(([name, contains]) => ({ name, contains, marks: marksOf(name, contains, isNas(name)), ...flagsOf(name, contains) }))

export function detailVenue(v: ExplorerVenueRow): ExplorerVenueRow {
  const family = venueFamily(v)
  return { ...v, accessibility: [...new Set([...v.accessibility, ...venueAccess(v)])], family, kidsMenu: family.length > 0 ? KIDS_MENU.map((k) => ({ ...k })) : [] }
}
