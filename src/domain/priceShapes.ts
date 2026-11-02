import type { Cents } from './money'
import type { CategoryId } from './ship'

/** The shapes of a price quote and a "from" price, and the party size a booking takes. No prices live here: the server works them out. */
export const MAX_GUESTS = 4

export type LineKey = 'fare' | 'extraFare' | 'soloSupplement' | 'taxes' | 'gratuities' | 'package'

export interface QuoteLine {
  key: LineKey
  /** The number of guests the line covers. */
  guests: number
  /** Amount for the whole line. */
  cents: Cents
}

export interface Quote {
  sailingId: string
  category: CategoryId
  guests: number
  lines: QuoteLine[]
  total: Cents
  perPerson: Cents
  /** Part of the total paid on board, as gratuities (still shown in the total so nothing is hidden). */
  gratuities: Cents
}

export interface FromPrice {
  fare: Cents
  taxes: Cents
  gratuities: Cents
  /** Fare, taxes and fees, and gratuities for one guest of two. */
  allIn: Cents
}
