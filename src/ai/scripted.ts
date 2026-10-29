import { ACTIVITIES, type Interest } from '../domain/excursions'
import type { EventInterest } from '../domain/program'
import { runTool } from './tools'
import type { Citation, Context, Reply } from './types'

/**
 * The concierge without a model: keywords pick one of a few topics, and the answer is written from the same tools the
 * model would use, so both give the same facts. Used when no key is set, offline, or when the model cannot be reached.
 */
type Data = Record<string, unknown>
const read = (name: string, input: Data, ctx: Context): { data: Data; citations: Citation[] } => {
  const r = runTool(name, input, ctx)
  return { data: JSON.parse(r.content) as Data, citations: r.citations }
}

const money = (n: unknown): string => `$${Number(n).toLocaleString('en-US')}`
const PORTS = [['cozumel', /cozumel|mexico/i], ['belize', /belize/i], ['roatan', /roat[aá]n|honduras/i]] as const
const portIn = (m: string): 'cozumel' | 'belize' | 'roatan' | undefined => PORTS.find(([, re]) => re.test(m))?.[0]
const WORDS: Record<string, Interest> = { snorkel: 'water', swim: 'water', beach: 'relax', relax: 'relax', ruins: 'culture', history: 'culture', mayan: 'culture', culture: 'culture', wildlife: 'nature', nature: 'nature', jungle: 'nature', adventure: 'adventure', zip: 'adventure', cave: 'adventure' }
const interestsIn = (m: string): Interest[] => [...new Set(Object.entries(WORDS).filter(([w]) => m.includes(w)).map(([, i]) => i))]
const EVENT_WORDS: Record<string, EventInterest> = { show: 'shows', music: 'music', trivia: 'games', game: 'games', spa: 'wellness', yoga: 'wellness', fitness: 'wellness', lecture: 'learning', kids: 'family', family: 'family', dance: 'nightlife', club: 'nightlife' }
const eventsIn = (m: string): EventInterest[] => [...new Set(Object.entries(EVENT_WORDS).filter(([w]) => m.includes(w)).map(([, i]) => i))]

const reply = (text: string, citations: Citation[] = []): Reply => ({ text, citations, source: 'scripted' })

/** An answer for the guest's message, always grounded on app data. Questions it cannot place get an honest "I can't" and where to go. */
export function scriptedReply(message: string, ctx: Context): Reply {
  const m = message.toLowerCase()
  const port = portIn(m)

  const dayNo = /\bday (\d)\b/.exec(m)?.[1]
  if (/plan my day|build my day|what should i do|day plan|itinerary for/.test(m) || (dayNo && /plan|do|suggest/.test(m))) {
    const day = Number(dayNo ?? (port ? { cozumel: 3, belize: 4, roatan: 5 }[port] : 2))
    const { data, citations } = read('build_day', { day, tour_interests: interestsIn(m), event_interests: eventsIn(m), mobility: /wheelchair/.test(m) ? 'wheelchair' : /easy|mobility|walk(ing)? (a lot|far)/.test(m) ? 'easy' : 'any', with_children: /kid|child|toddler|family/.test(m) }, ctx)
    const items = (data.items as { title: string; starts: string; why: string }[] | undefined) ?? []
    if (items.length === 0) return reply(`I could not find a day to suggest for day ${day}. Try Build my day in the Plan tab.`, citations)
    const back = data.back_on_ship_by ? ` Be back on the ship by ${String(data.back_on_ship_by)}.` : ''
    return reply(`Here is a day for day ${day}:\n${items.map((i) => `• ${i.starts} ${i.title} (${i.why})`).join('\n')}${back}`, citations)
  }
  if (/alaska|europe|mediterranean|hawaii|pacific|asia|transatlantic/.test(m)) {
    return reply('This app covers one cruise: seven nights in the Western Caribbean on Sun Princess from Fort Lauderdale, so I cannot plan other destinations here. I can show the dates and prices for this one.', runTool('list_sailings', {}, ctx).citations)
  }
  if (/book (it|this|me)|reserve|buy|pay for|purchase/.test(m)) {
    return reply('I cannot book or take payment in this chat. Choose a date and I will take you to the booking steps, where you confirm everything before anything is charged.', [{ label: 'Book this cruise', path: '/book' }])
  }
  if (/excursion|tour|snorkel|ruins|zip|cave|things to do|activit/.test(m) || (port && /do|see/.test(m))) {
    const wheelchair = /wheelchair/.test(m)
    const { data, citations } = read('search_excursions', { port, interests: interestsIn(m), family: /kid|child|toddler|family/.test(m), wheelchair, max_activity: /easy|gentle|relax/.test(m) ? ACTIVITIES[0] : undefined }, ctx)
    const rows = (data.excursions as { name: string; hours: number; usd_per_adult: number; rating: number }[]).slice(0, 4)
    if (rows.length === 0) return reply('No excursion matches all of that. Try fewer filters on the Excursions screen.', citations)
    return reply(`These shore excursions fit:\n${rows.map((r) => `• ${r.name}, ${r.hours} hours, ${money(r.usd_per_adult)} per adult, rated ${r.rating}`).join('\n')}`, citations)
  }
  if (port || /port|stop|where does/.test(m)) {
    if (port) {
      const { data, citations } = read('get_port', { port }, ctx)
      return reply(`${String(data.name)}: ${String(data.about)} Getting ashore: ${String(data.landing)}. ${String(data.access)}`, citations)
    }
    const { data, citations } = read('get_itinerary', {}, ctx)
    const days = data.days as { day: number; place: string }[]
    return reply(`Your week: ${days.map((d) => `day ${d.day} ${d.place}`).join(', ')}.`, citations)
  }
  if (/dinner|restaurant|dining|eat|steak|italian|seafood/.test(m)) {
    const { data, citations } = read('list_restaurants', {}, ctx)
    const rows = data.restaurants as { name: string; cuisine: string; cover_usd_per_person: number }[]
    return reply(`You can eat at:\n${rows.map((r) => `• ${r.name}, ${r.cuisine}${r.cover_usd_per_person > 0 ? `, ${money(r.cover_usd_per_person)} cover` : ', included'}`).join('\n')}`, citations)
  }
  if (/price|cost|cheap|date|when|sail|depart|how much|budget|\bjune\b|\bmarch\b|\bjan/.test(m)) {
    const month = /(20\d\d)-(\d\d)/.exec(m)?.[0]
    const { data, citations } = read('list_sailings', { month }, ctx)
    const rows = data.sailings as { departs: string; from_usd_per_person: number }[]
    return reply(`Seven-night departures from Fort Lauderdale:\n${rows.map((r) => `• ${r.departs}, from ${money(r.from_usd_per_person)} per person (two sharing, with taxes, fees and gratuities)`).join('\n')}`, citations)
  }
  if (/my trip|my cruise|who is|my booking|party/.test(m)) {
    const { data, citations } = read('my_trip', {}, ctx)
    const party = (data.party as { name: string }[] | undefined)?.map((p) => p.name).join(', ')
    return reply(data.error ? 'Sign in to see your trip.' : `You are sailing on ${String(data.departs)} aboard Sun Princess with ${party}.`, citations)
  }
  return reply('I can help with dates and prices, the itinerary, ports, shore excursions, dining and a plan for a day. For anything else, I can pass you to a person.', [])
}
