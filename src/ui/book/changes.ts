import { resizePeople, type Draft } from '../../domain/booking'
import { fareIncluded, fareOptions } from '../../domain/fares'
import type { CategoryId } from '../../domain/ship'

/** Choosing a different sailing clears a stateroom picked on the old one. */
export const withSailing = (id: string) => (d: Draft): Draft => (d.sailingId === id ? d : { ...d, sailingId: id, cabinNumber: '' })

/** Choosing a room type: guests that do not fit are dropped, and a fare the room cannot take is cleared (or set, when the room includes one). */
export const withCategory = (category: CategoryId, capacity: number) => (d: Draft): Draft => {
  if (d.category === category) return d
  const sized = d.guests > capacity ? resizePeople(d, capacity) : d
  const fare = sized.fare && fareOptions(category).includes(sized.fare) ? sized.fare : (fareIncluded(category) ?? '')
  return { ...sized, category, fare, cabinNumber: '' }
}
