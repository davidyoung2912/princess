import { formatDate } from './cruise'
import { formatMoney, type Cents } from './money'

/** My shortlist summary (N-V1): the sailing, room, fare, price and the honest-fit read gathered into one "case for this trip". */
export interface ShortlistInput {
  /** The sailing's departure date, as the catalogue gives it. */
  departure: string
  title: string
  ship: string
  nights: number
  from: string
  /** Places the cruise calls at. */
  ports: readonly string[]
  categoryName: string | null
  fareName: string | null
  guests: number
  /** The all-in price for the party, or null until a room and fare are chosen. */
  total: Cents | null
  budget: Cents | null
  /** What the guest ticked on the honest-fit page, in their words. */
  fit: readonly string[]
  /** Places the guest wants that this cruise visits. */
  wantedHere: readonly string[]
}

export interface ShortlistCase {
  heading: string
  rows: { label: string; value: string }[]
  fit: string[]
  open: string[]
}

export function shortlistCase(i: ShortlistInput): ShortlistCase {
  const rows: { label: string; value: string }[] = []
  const open: string[] = []
  const trip = [i.ship, i.nights > 0 ? `${i.nights} nights` : '', i.from ? `from ${i.from}` : ''].filter(Boolean).join(', ')
  rows.push({ label: 'Sailing', value: [formatDate(i.departure), trip].filter(Boolean).join(', ') })
  if (i.ports.length > 0) rows.push({ label: 'Calls at', value: i.ports.join(', ') })
  if (i.wantedHere.length > 0) rows.push({ label: 'Places you want', value: i.wantedHere.join(', ') })
  rows.push({ label: 'Guests', value: String(i.guests) })
  if (i.categoryName) rows.push({ label: 'Room type', value: i.categoryName })
  else open.push('Choose a room type')
  if (i.fareName) rows.push({ label: 'Fare', value: i.fareName })
  else open.push('Choose a fare')
  if (i.total !== null) {
    rows.push({ label: 'All-in price', value: `${formatMoney(i.total)}, with gratuities and taxes` })
    if (i.nights > 0 && i.guests > 0) rows.push({ label: 'Per person a night', value: formatMoney(Math.round(i.total / i.guests / i.nights)) })
    if (i.budget !== null && i.budget > 0) rows.push({ label: 'Your budget', value: i.total <= i.budget ? `Fits, with ${formatMoney(i.budget - i.total)} left` : `${formatMoney(i.total - i.budget)} over` })
  }
  open.push('Drinks, Wi-Fi, dining and tours are on top of the price')
  if (i.fit.length === 0) open.push('Read the honest-fit page')
  return { heading: i.title || 'My shortlist', rows, fit: [...i.fit], open }
}

export function shortlistText(c: ShortlistCase): string {
  const block = (h: string, l: readonly string[]) => (l.length ? `${h}\n${l.map((x) => `- ${x}`).join('\n')}` : '')
  return [c.heading, c.rows.map((r) => `${r.label}: ${r.value}`).join('\n'), block('Why it suits me', c.fit), block('Still to settle', c.open)].filter(Boolean).join('\n\n')
}
