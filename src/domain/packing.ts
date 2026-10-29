import { excursionById, type ExcursionItem } from './excursions'
import type { NeedId } from './account'

/** The packing list generator (MNG-08): built from the itinerary, the season, the dress codes, the ship and what the party has booked. */
export type PackGroup = 'documents' | 'clothes' | 'beach' | 'health' | 'tech' | 'kids'
export const PACK_GROUPS: readonly PackGroup[] = ['documents', 'clothes', 'beach', 'health', 'tech', 'kids']

export interface PackItem {
  id: string
  group: PackGroup
  label: string
  /** Why it is on the list, shown beside it. */
  why: string
}

export interface Weather {
  highF: number
  lowF: number
  rain: 'low' | 'some' | 'high'
  note: string
}

/** Typical weather in the western Caribbean by month (1 = January). Authored from climate norms. */
export const WEATHER: Record<number, Weather> = {
  1: { highF: 82, lowF: 72, rain: 'low', note: 'Dry, warm and breezy.' },
  2: { highF: 83, lowF: 72, rain: 'low', note: 'Dry, warm and breezy.' },
  3: { highF: 84, lowF: 74, rain: 'low', note: 'Warm and mostly dry, with strong sun.' },
  4: { highF: 85, lowF: 75, rain: 'low', note: 'Hot and dry before the rains.' },
  5: { highF: 87, lowF: 77, rain: 'some', note: 'Hotter, with the first showers.' },
  6: { highF: 88, lowF: 78, rain: 'high', note: 'Hot, humid and showery. Hurricane season begins.' },
  7: { highF: 89, lowF: 79, rain: 'some', note: 'Hot and humid, with passing storms.' },
  8: { highF: 89, lowF: 79, rain: 'some', note: 'Hot and humid, with passing storms.' },
  9: { highF: 88, lowF: 78, rain: 'high', note: 'Wettest month, with storm risk.' },
  10: { highF: 86, lowF: 77, rain: 'high', note: 'Wet, with storm risk easing.' },
  11: { highF: 84, lowF: 75, rain: 'some', note: 'Drier and cooler as the season ends.' },
  12: { highF: 82, lowF: 73, rain: 'low', note: 'Dry, warm and the busiest season.' },
}

export const weatherFor = (date: string): Weather => WEATHER[Number(date.slice(5, 7))]

export interface PackInput {
  /** Sailing departure, "YYYY-MM-DD". */
  departure: string
  nights: number
  /** Excursion ids booked by anyone in the party. */
  tours: readonly string[]
  /** Ages of the people in the party. */
  ages: readonly number[]
  needs: readonly NeedId[]
  /** Whether the itinerary has a tender port. */
  tender: boolean
  /** How many nights have an elegant dress code. */
  elegantNights: number
}

/** Elegant evenings on a seven-night cruise: two. */
export const elegantNights = (nights: number): number => (nights >= 7 ? 2 : nights >= 5 ? 1 : 0)

export function buildPackingList(i: PackInput): PackItem[] {
  const w = weatherFor(i.departure)
  const kinds = new Set(i.tours.map((id) => excursionById(id)).filter((x): x is ExcursionItem => !!x).flatMap((x) => [x.activity, ...x.interests]))
  const items: PackItem[] = []
  const add = (id: string, group: PackGroup, label: string, why: string) => items.push({ id, group, label, why })

  add('passport', 'documents', 'Passports for everyone', 'Needed to board and to come home. Keep them in your hand luggage.')
  add('boardingDocs', 'documents', 'Printed boarding documents and luggage tags', 'Check-in is quicker with paper as a back-up to your phone.')
  add('cards', 'documents', 'Credit card and some small bills', 'For tips ashore, taxis and small shops.')
  add('insurance', 'documents', 'Travel insurance details', 'Keep the policy number and phone number together.')

  add('daywear', 'clothes', `Lightweight daywear for ${i.nights} days`, `Highs of ${w.highF}°F and lows of ${w.lowF}°F. ${w.note}`)
  add('smart', 'clothes', 'Smart casual outfits for dinner', 'Collared shirts or a nice top; shorts and flip-flops are not worn at dinner.')
  if (i.elegantNights > 0) add('elegant', 'clothes', `${i.elegantNights === 1 ? 'One outfit' : `${i.elegantNights} outfits`} for elegant evenings`, 'A jacket or a dress; the ship marks these nights on the daily plan.')
  add('lightLayer', 'clothes', 'A light jacket or wrap', 'Dining rooms and the Dome theatre are cool, and the evening deck breeze is stronger.')
  add('comfyShoes', 'clothes', 'Comfortable walking shoes', 'The ship is long, and ports mean cobbles and uneven pavements.')
  if (w.rain !== 'low') add('rain', 'clothes', 'A light rain jacket or compact umbrella', `Showers are ${w.rain === 'high' ? 'likely' : 'possible'} at this time of year.`)

  add('swim', 'beach', 'Two swimsuits', 'One is always drying.')
  add('sunscreen', 'beach', 'Sunscreen, reef-safe if you will snorkel', 'The Caribbean sun burns in under 30 minutes.')
  add('hat', 'beach', 'Hat and sunglasses', 'Shade is scarce on the pier and the pool deck.')
  if (kinds.has('water')) add('waterShoes', 'beach', 'Water shoes and a quick-dry towel', 'For your snorkelling or beach excursion. Gear is provided; shoes are not.')
  if (kinds.has('culture')) add('ruinsShoes', 'beach', 'Sturdy shoes and a small day bag', 'For the temple or ruins visit: steps, stones and no shade.')
  if (kinds.has('strenuous')) add('closedShoes', 'beach', 'Closed shoes you can get muddy', 'Your zip-line or cave tour needs them.')
  if (i.tender) add('tenderBag', 'beach', 'A small bag with a zip', 'Going ashore by tender at Belize City: you will step across a gap, so keep both hands free.')

  add('meds', 'health', 'Prescription medicines in their own bottles, in hand luggage', 'Pack extra for two days. Do not put them in checked bags.')
  add('firstAid', 'health', 'Seasickness tablets and a small first-aid kit', 'The medical centre charges for these.')
  if (i.needs.includes('cpap')) add('cpap', 'health', 'CPAP machine, distilled water and an extension cord', 'Staterooms have limited sockets. Ask for a power strip in your assistance request.')
  if (i.needs.includes('oxygen')) add('oxygen', 'health', 'Portable oxygen concentrator and spare batteries', 'Carry them yourself. Tell the ship in advance.')
  if (i.needs.includes('hearing')) add('hearing', 'health', 'Hearing aid batteries and a spare', 'The assistive listening request covers the theatre, not your room.')
  if (i.needs.includes('mobility')) add('mobility', 'health', 'Charger and spare parts for your mobility aid', 'Tender and shore transport cannot always carry repairs.')

  add('chargers', 'tech', 'Phone chargers and a power strip without a surge protector', 'Surge protectors are not allowed on board.')
  add('battery', 'tech', 'A portable battery', 'Useful for a long day ashore with no outlets.')
  add('offline', 'tech', 'Offline copies of your tickets and maps', 'Wi-Fi at sea is slow. Download them before you leave home.')

  if (i.ages.some((a) => a < 3)) add('swimDiapers', 'kids', 'Swim nappies and baby supplies', 'The pools require swim nappies for babies and toddlers.')
  if (i.ages.some((a) => a < 18)) add('games', 'kids', 'Cards, small games and books', 'For quiet time in the cabin and long days at sea.')
  if (i.ages.some((a) => a >= 13 && a < 18)) add('teenClothes', 'kids', 'Clothes for the Underground and the pool deck', 'Teen club nights have their own dress ideas.')

  return items
}

/** The list as plain text, to share with the people you are travelling with. Ticked items are marked. */
export function packingText(title: string, items: readonly PackItem[], ticked: readonly string[]): string {
  const lines = [title]
  for (const g of PACK_GROUPS) {
    const list = items.filter((x) => x.group === g)
    if (list.length === 0) continue
    lines.push('', g.toUpperCase())
    for (const x of list) lines.push(`${ticked.includes(x.id) ? '[x]' : '[ ]'} ${x.label}`)
  }
  return lines.join('\n')
}
