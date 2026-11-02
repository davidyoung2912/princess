import { bookingQuote, fareOptions, FARES, type FareId } from './fares'
import { formatDate } from './cruise'
import { formatMoney, NIGHTS, type Cents } from './pricing'
import type { Sailing } from './sailings'
import { CATEGORIES, type CategoryId } from './ship'

/**
 * Dream and decide (S0-01 to S0-05, S0-10). Plain, honest words: who this cruise is for and who it is not for, the real fears, a budget-first search,
 * a quality note for each sailing, a decision summary, and an invitation as text. The quality figures are simulations (`source: 'sim'`).
 */

// ---- S0-01: is this for me? ----

export type FitKey = 'tenders' | 'quiet' | 'mobility' | 'party' | 'budget' | 'kids' | 'port'
export interface FitRule { key: FitKey; question: string; yes: string }
export const FIT_QUESTIONS: readonly FitRule[] = [
  { key: 'tenders', question: 'I dislike tenders (small boats to shore).', yes: 'Belize City is a tender port. You ride a small boat to the pier, which has steps and a wait when the sea is up. You may prefer to stay aboard that day, which is a fine choice.' },
  { key: 'quiet', question: 'I want a quiet holiday.', yes: 'Choose a lower midship cabin away from the pool decks, and use the quiet spaces on deck. The Piazza and the Dome are lively into the evening, and sea days are the busiest.' },
  { key: 'mobility', question: 'I use a wheelchair or find long walks hard.', yes: 'There are 51 accessible staterooms and step-free routes, but the ship is long, and tender help in Belize City is limited. Ask for assistance at least 30 days before sailing.' },
  { key: 'party', question: 'I want nightlife and a party.', yes: 'This is a family ship. There are shows, bars in the Piazza and a late dance party in the Dome, but no large nightclub scene. It will suit you if you like music with a drink.' },
  { key: 'budget', question: 'I need the lowest possible price.', yes: 'The advertised fare is for an interior room for two. Gratuities, taxes and fees are added, and drinks, Wi-Fi and specialty dining cost extra, so use the budget search below.' },
  { key: 'kids', question: 'I am travelling with young children.', yes: 'Firefly Park (3 to 7), Neon Grove (8 to 12) and The Underground (13 to 17) are on decks 6 and 7. Connecting cabins are limited, so book early.' },
  { key: 'port', question: 'I want long days ashore.', yes: 'There are three port days, each of about nine hours, and the ship leaves at 17:00. A tour that runs late is your risk to manage; the app will watch the clock.' },
]

export const SUITS: readonly string[] = ['Families who want a lot to do in one place', 'First-time cruisers who want things to be easy', 'People who like a warm sea day and a beach day in turn', 'Groups who want to eat together without cooking']
export const NOT_FOR: readonly string[] = ['Anyone who wants remote or off-the-path places: these are busy cruise ports', 'Anyone who hates crowds at the buffet or the pool on a sea day', 'Anyone for whom a week away from a doctor, or from signal, is a worry (read the health page first)']

export function fitNotes(picked: readonly FitKey[]): string[] {
  return FIT_QUESTIONS.filter((q) => picked.includes(q.key)).map((q) => q.yes)
}

// ---- S0-02: first-timer reassurance and glossary ----

export interface Fear { id: string; question: string; answer: string }
export const FEARS: readonly Fear[] = [
  { id: 'seasick', question: 'What if I get seasick?', answer: 'This ship is big and has stabilisers, and the Caribbean is usually calm. Most people feel nothing. A cabin midship on a low deck moves least. Wristbands and tablets from the shop help, and the medical centre can give an injection.' },
  { id: 'cost', question: 'What will it really cost?', answer: 'The advertised price is the fare. Taxes, fees and gratuities are added, and drinks, Wi-Fi, specialty dinners and tours cost extra. Use the budget search or the trip cost page to see the real total before you book.' },
  { id: 'crowds', question: 'Will it be crowded?', answer: 'About 4,300 guests are on board, and some places get busy at set times: the buffet at noon, the pool on a sea day. Ship Pulse shows how busy a place is. There are quiet spaces too.' },
  { id: 'hate', question: 'What if I hate it?', answer: 'You can leave the ship at any port, but you would pay your own way home. Most people find something they enjoy in a week. The fare rules show what can be refunded before you sail; read them before you pay.' },
  { id: 'dress', question: 'Do I have to dress up?', answer: 'No. Days are shorts and sandals. Some dinners ask for smart dress. Elegant nights are optional, and you can always eat at the buffet.' },
  { id: 'ill', question: 'What if I get ill?', answer: 'There is a medical centre on board with a doctor and nurses, open every day. There is a fee for care, so keep your travel insurance details to hand. The app has a page for what to do first.' },
]

export interface Term { term: string; meaning: string }
export const GLOSSARY: readonly Term[] = [
  { term: 'Muster', meaning: 'A safety drill on the first day. You learn where to go in an emergency.' },
  { term: 'Tender', meaning: 'A small boat that takes you from the ship to shore when the ship cannot dock.' },
  { term: 'Folio', meaning: 'Your account on board. Everything you charge goes on it and is paid at the end.' },
  { term: 'Medallion', meaning: 'A small wearable that opens your door, pays for things and finds you on the ship.' },
  { term: 'Port side', meaning: 'The left side of the ship as you face the front. The right is starboard.' },
  { term: 'Stateroom', meaning: 'Your cabin.' },
  { term: 'All aboard', meaning: 'The time you must be back on the ship in port. The ship leaves on time without you.' },
  { term: 'Sea day', meaning: 'A day with no port, spent at sea.' },
  { term: 'Gangway', meaning: 'The ramp between the ship and the pier.' },
  { term: 'Deck', meaning: 'A floor of the ship.' },
]

// ---- S0-03: budget first ----

export interface BudgetOption {
  category: CategoryId
  fare: FareId
  total: Cents
  /** What is left of the budget. */
  left: Cents
  /** Left per person per night: what the rest of the money stretches to. */
  perPersonPerDay: Cents
  fits: boolean
}

export interface BudgetResult {
  fitting: BudgetOption[]
  /** The cheapest options that do not fit, so the guest can see how far off they are. */
  nearMiss: BudgetOption[]
  /** The cheapest total for this sailing and party. */
  cheapest: Cents | null
}

export const MAX_BUDGET: Cents = 100_000_000

export function budgetSearch(sailing: Sailing, budget: Cents, guests: number): BudgetResult {
  if (!Number.isInteger(guests) || guests < 1 || guests > 4 || !Number.isFinite(budget) || budget < 0) return { fitting: [], nearMiss: [], cheapest: null }
  const b = Math.min(Math.round(budget), MAX_BUDGET)
  const all: BudgetOption[] = []
  for (const c of CATEGORIES) {
    for (const fare of fareOptions(c.id)) {
      const q = bookingQuote(sailing.id, c.id, guests, fare)
      if (!q) continue
      const left = b - q.total
      all.push({ category: c.id, fare, total: q.total, left, perPersonPerDay: Math.round(Math.max(0, left) / guests / NIGHTS), fits: left >= 0 })
    }
  }
  all.sort((x, y) => x.total - y.total)
  const fitting = all.filter((o) => o.fits).sort((x, y) => y.total - x.total)
  return { fitting, nearMiss: all.filter((o) => !o.fits).slice(0, 3), cheapest: all[0]?.total ?? null }
}

// ---- S0-04: sailing quality ----

export type Level = 'low' | 'medium' | 'high'
export interface QualityNote { key: 'crowds' | 'weather' | 'hurricane' | 'school' | 'price'; level: Level; text: string; why: string }
export interface SailingQuality { sailingId: string; notes: QualityNote[]; source: 'sim' }


// ---- S0-10: decision confidence summary ----

export interface DecisionInput {
  sailing: Sailing | null
  category: CategoryId | null
  fare: FareId | null
  guests: number
  fitsChecked: boolean
  budget: Cents | null
}

export interface DecisionSummary { decided: string[]; left: string[]; mightChange: string[] }

export function decisionSummary(i: DecisionInput): DecisionSummary {
  const decided: string[] = []
  const left: string[] = []
  const mightChange: string[] = []
  if (i.sailing) decided.push(`Sailing: ${formatDate(i.sailing.departure)}`)
  else left.push('Choose a sailing')
  const cat = CATEGORIES.find((c) => c.id === i.category)
  if (cat) decided.push(`Room type: ${cat.name}`)
  else left.push('Choose a room type')
  if (i.fare) decided.push(`Fare: ${FARES[i.fare].name}`)
  else left.push('Choose a fare')
  decided.push(`Guests: ${i.guests}`)
  const q = i.sailing && i.category && i.fare ? bookingQuote(i.sailing.id, i.category, i.guests, i.fare) : null
  if (q) decided.push(`All-in price: ${formatMoney(q.total)}, with gratuities and taxes`)
  if (i.budget !== null && q) (q.total <= i.budget ? decided : left).push(q.total <= i.budget ? `This fits your budget of ${formatMoney(i.budget)}` : `This is ${formatMoney(q.total - i.budget)} over your budget of ${formatMoney(i.budget)}`)
  if (!i.fitsChecked) left.push('Read the honest-fit page')
  left.push('Choose a cabin', 'Check what the fare does not include')
  mightChange.push('The fare can rise, so a price you saw today is not held until you book', 'A hurricane, a port closure or a ship change can alter the route', 'Drinks, Wi-Fi, dining and tours are on top of the price')
  return { decided, left, mightChange }
}

export function decisionText(s: DecisionSummary): string {
  const block = (h: string, l: readonly string[]) => (l.length ? `${h}\n${l.map((x) => `- ${x}`).join('\n')}` : '')
  return [block('Decided', s.decided), block('Still to do', s.left), block('Could change my mind', s.mightChange)].filter(Boolean).join('\n\n')
}

// ---- S0-05: invite a friend (text only; no link is made without a server) ----

export const INVITE_NAME_MAX = 40

/** The invitation as text. It names the sailing and the ship, and nothing about the sender but the first name they typed. */
export function inviteText(sailing: Sailing, firstName: string, note: string): string {
  const name = firstName.trim().slice(0, INVITE_NAME_MAX) || 'A friend'
  const lines = [`${name} would like you to come cruising: Sun Princess, 7 nights from Fort Lauderdale, leaving ${formatDate(sailing.departure)}.`, 'Cozumel, Belize City and Roatán.']
  const extra = note.trim().slice(0, 200)
  if (extra) lines.push(extra)
  return lines.join('\n')
}
