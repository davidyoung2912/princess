import { ACTIVITIES, EXCURSIONS, filterExcursions, INTERESTS, NO_FILTER, type Activity, type Interest } from '../domain/excursions'
import { buildDay, NO_WISH, type Mobility } from '../domain/day'
import { VENUES } from '../domain/dining'
import { partyOf, personaById } from '../domain/personas'
import { portGuideById } from '../domain/ports'
import { fromPrice } from '../domain/pricing'
import { EVENT_INTERESTS, type EventInterest } from '../domain/program'
import { SAILINGS, sailingById } from '../domain/sailings'
import { formatDate, stops } from '../domain/cruise'
import type { Citation, Context, ToolResult } from './types'

/**
 * The only facts the concierge may use: each tool reads app data, and every answer carries the screens it came from
 * (the "citations"). Nothing here books, pays or changes anything; booking stays in the app's own confirmed flow.
 */
export interface ToolDef {
  name: string
  description: string
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
}

export const TOOLS: readonly ToolDef[] = [
  { name: 'list_sailings', description: 'The departures that can be booked, with the lowest all-in price per person (two sharing). This app has one 7-night Western Caribbean cruise on Sun Princess from Fort Lauderdale; there are no other destinations.', input_schema: { type: 'object', properties: { month: { type: 'string', description: 'Optional "YYYY-MM" to list only that month.' } } } },
  { name: 'get_itinerary', description: 'The day-by-day itinerary of a departure: port, arrival, all-aboard time.', input_schema: { type: 'object', properties: { sailing_id: { type: 'string', description: 'A sailing id from list_sailings; defaults to the guest’s own cruise.' } } } },
  { name: 'get_port', description: 'A port guide: how the ship reaches shore, access, best time and what to do.', input_schema: { type: 'object', properties: { port: { type: 'string', enum: ['fll', 'cozumel', 'belize', 'roatan'] } }, required: ['port'] } },
  { name: 'search_excursions', description: 'Shore excursions, filtered. Prices are per adult in US dollars.', input_schema: { type: 'object', properties: { port: { type: 'string', enum: ['cozumel', 'belize', 'roatan'] }, interests: { type: 'array', items: { type: 'string', enum: [...INTERESTS] } }, max_activity: { type: 'string', enum: [...ACTIVITIES] }, max_price_usd: { type: 'number' }, family: { type: 'boolean', description: 'Only tours suitable for children.' }, wheelchair: { type: 'boolean', description: 'Only tours a wheelchair user can join.' } } } },
  { name: 'list_restaurants', description: 'Dining venues on the ship with cuisine, cover charge and dress code.', input_schema: { type: 'object', properties: {} } },
  { name: 'build_day', description: 'A suggested plan for one day of the cruise (1 to 8): a tour that fits the ship’s day, ship events and dinner.', input_schema: { type: 'object', properties: { day: { type: 'integer', minimum: 1, maximum: 8 }, tour_interests: { type: 'array', items: { type: 'string', enum: [...INTERESTS] } }, event_interests: { type: 'array', items: { type: 'string', enum: [...EVENT_INTERESTS] } }, mobility: { type: 'string', enum: ['any', 'easy', 'wheelchair'] }, with_children: { type: 'boolean' } }, required: ['day'] } },
  { name: 'my_trip', description: 'The signed-in guest’s own cruise: who is in the party, the departure and stateroom type.', input_schema: { type: 'object', properties: {} } },
]

type Input = Record<string, unknown>
const text = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const list = <T extends string>(v: unknown, allowed: readonly T[]): T[] => (Array.isArray(v) ? v.filter((x): x is T => allowed.includes(x as T)) : [])
const ok = (data: unknown, citations: Citation[]): ToolResult => ({ content: JSON.stringify(data), citations })
const fail = (message: string): ToolResult => ({ content: JSON.stringify({ error: message }), citations: [], isError: true })

const usd = (cents: number): number => Math.round(cents / 100)

/** Runs one tool for the guest in `ctx`. Unknown tools and bad input answer with an error the model can read, never a throw. */
export function runTool(name: string, input: Input, ctx: Context): ToolResult {
  const own = sailingById(ctx.sailingId)
  switch (name) {
    case 'list_sailings': {
      const month = text(input.month)
      const rows = SAILINGS.filter((s) => !month || s.departure.startsWith(month)).map((s) => ({
        id: s.id, departs: s.departure, nights: 7, ship: 'Sun Princess', holiday: !!s.holiday, from_usd_per_person: usd(fromPrice(s.id)?.allIn ?? 0),
      }))
      const citations: Citation[] = rows.length > 0 && rows.length <= 3 ? rows.map((r) => ({ label: formatDate(r.departs), path: `/home/sailings/${r.id}` })) : [{ label: 'Sailings and prices', path: '/home/sailings' }]
      return ok({ sailings: rows }, citations)
    }
    case 'get_itinerary': {
      const s = sailingById(text(input.sailing_id) ?? ctx.sailingId)
      if (!s) return fail('Unknown sailing id.')
      return ok({ departs: s.departure, days: stops(s).map((d) => ({ day: d.day, date: d.date, place: d.place, arrives: d.arrive ?? null, all_aboard: d.allAboard ?? null, tender: d.tender })) }, [{ label: `Itinerary, ${formatDate(s.departure)}`, path: `/home/sailings/${s.id}` }])
    }
    case 'get_port': {
      const g = portGuideById(input.port)
      if (!g) return fail('Unknown port.')
      return ok({ name: g.short, landing: g.landing, about: g.blurb, best_time: g.bestTime, access: g.access, things_to_do: g.doThis }, [{ label: g.short, path: `/home/ports/${g.id}` }])
    }
    case 'search_excursions': {
      const interests = list<Interest>(input.interests, INTERESTS)
      const activity = list<Activity>([input.max_activity], ACTIVITIES)[0] ?? null
      const price = num(input.max_price_usd)
      const port = ['cozumel', 'belize', 'roatan'].includes(String(input.port)) ? (input.port as 'cozumel' | 'belize' | 'roatan') : null
      const found = filterExcursions(EXCURSIONS, { ...NO_FILTER, port, interests, maxActivity: activity, maxPrice: price === undefined ? null : Math.round(price * 100), family: input.family === true, accessible: input.wheelchair === true })
      return ok({ excursions: found.map((x) => ({ id: x.id, name: x.name, port: x.port, hours: x.hours, usd_per_adult: usd(x.price), activity: x.activity, rating: x.rating, starts: x.start, wheelchair: x.wheelchair, family: x.family })) }, [{ label: 'Shore excursions', path: '/plan/excursions' }])
    }
    case 'list_restaurants':
      return ok({ restaurants: VENUES.map((v) => ({ id: v.id, name: v.name, kind: v.kind, cuisine: v.cuisine, deck: v.deck, cover_usd_per_person: usd(v.cover), dress: v.dress, walk_in: !!v.walkIn })) }, [{ label: 'Dining', path: '/plan/dining' }])
    case 'build_day': {
      const day = num(input.day)
      if (!own || day === undefined || !Number.isInteger(day) || day < 1 || day > 8) return fail('day must be a whole number from 1 to 8.')
      const mobility = list<Mobility>([input.mobility], ['any', 'easy', 'wheelchair'])[0] ?? 'any'
      const plan = buildDay(own, day, { ...NO_WISH, tours: list<Interest>(input.tour_interests, INTERESTS), events: list<EventInterest>(input.event_interests, EVENT_INTERESTS), mobility, withKids: input.with_children === true })
      return ok({ day, items: plan.items.map((i) => ({ kind: i.kind, title: i.title, starts: i.start, why: i.why })), back_on_ship_by: plan.backBy }, [{ label: 'Build my day', path: '/plan/day' }])
    }
    case 'my_trip': {
      const me = personaById(ctx.personaId)
      if (!me || !own) return fail('No signed-in guest.')
      return ok({ guest: me.name, party: partyOf(me.id).map((p) => ({ name: p.name, age: p.age })), departs: own.departure, ship: 'Sun Princess', stateroom: me.stateroom, loyalty: me.tier }, [{ label: 'My trips', path: '/me/trips' }])
    }
    default:
      return fail(`Unknown tool ${name}.`)
  }
}
