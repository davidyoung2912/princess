import { formatTime } from './cruise'
import { formatHours, type Activity, type ExcursionItem, type ExcursionPort } from './excursions'
import { formatMoney } from './money'

/** The three questions the fit finder asks, plus an optional port. */
export interface FitAnswers {
  /** The most strenuous tour the party is happy with. */
  activity: Activity
  /** The most to spend per adult, in dollars, or null for no limit. */
  maxPrice: number | null
  /** Who is going. */
  who: 'adults' | 'children' | 'wheelchair'
  port: ExcursionPort | null
}

export const NO_FIT: FitAnswers = { activity: 'moderate', maxPrice: null, who: 'adults', port: null }

/** What the finder needs of an offer: the tour, whether it is still on sale, and when the guest must be back. */
export interface FitOffer {
  item: ExcursionItem
  spots: number
  backBy: string
  timing: unknown
}

export interface FitMatch<T extends FitOffer = FitOffer> {
  offer: T
  /** Plain reasons it fits, e.g. "Easy", "3 hours", "back by 2:30 PM", "step-free". */
  reasons: string[]
}

const LEVEL: Record<Activity, number> = { easy: 0, moderate: 1, strenuous: 2 }
const LEVEL_WORD: Record<Activity, string> = { easy: 'Easy', moderate: 'Moderate', strenuous: 'Strenuous' }

/** Whether a tour is ruled out by the answers: too hard, too dear, not for the party, sold out, or not fitting the ship's day. */
function ruledOut(o: FitOffer, a: FitAnswers): boolean {
  const x = o.item
  if (o.spots <= 0 || o.timing) return true
  if (a.port && x.port !== a.port) return true
  if (LEVEL[x.activity] > LEVEL[a.activity]) return true
  if (a.maxPrice !== null && x.price > a.maxPrice * 100) return true
  if (a.who === 'wheelchair' && !x.wheelchair) return true
  if (a.who === 'children' && !x.family) return true
  return false
}

/** The tours that fit, best first: a better rating, then fewer reviews' doubt, then lower price. Each carries its reasons. */
export function fitTours<T extends FitOffer>(offers: readonly T[], a: FitAnswers): FitMatch<T>[] {
  return offers
    .filter((o) => !ruledOut(o, a))
    .map((offer) => {
      const x = offer.item
      const reasons = [LEVEL_WORD[x.activity], formatHours(x.hours), `back by ${formatTime(offer.backBy)}`]
      if (x.wheelchair) reasons.push(x.confirmAccess ? 'step-free (confirm with the operator)' : 'step-free')
      if (a.who === 'children') reasons.push('suits families')
      reasons.push(`${formatMoney(x.price)} an adult`)
      return { offer, reasons }
    })
    .sort((p, q) => q.offer.item.rating - p.offer.item.rating || q.offer.item.reviews - p.offer.item.reviews || p.offer.item.price - q.offer.item.price)
}
