import type { Http } from '../api/http'
import { isApiError } from '../api/errors'
import type { Remote } from './sync'

interface StateDto { key: string; version: number; data: unknown; updatedAt: number }
interface TripsDto { upcoming: { kind: string; number: string }[] }

const path = (key: string, booking?: string): string =>
  booking === undefined ? `/me/state/${encodeURIComponent(key)}` : `/bookings/${encodeURIComponent(booking)}/state/${encodeURIComponent(key)}`

/** The account-state routes (`/me/state/{key}`, and `/bookings/{number}/state/{key}` for documents shared by a booking) as a `Remote`. */
export const createHttpRemote = (http: Http): Remote => ({
  get: async (key, booking) => {
    const doc = await http.get<StateDto | null>(path(key, booking))
    return doc ? { version: doc.version, data: doc.data } : null
  },
  put: async (key, data, baseVersion, booking) => {
    const doc = await http.put<StateDto>(path(key, booking), { data, baseVersion })
    return { version: doc.version, data: doc.data }
  },
  remove: async (key, booking) => { await http.delete(path(key, booking)) },
  /** The current trip, found the same way the booking screens find it. */
  bookingNumber: async () => {
    try {
      const trips = await http.get<TripsDto>('/trips')
      return (trips.upcoming.find((t) => t.kind === 'current') ?? trips.upcoming[0])?.number ?? null
    } catch (e) {
      if (isApiError(e) && e.code === 'notFound') return null
      throw e
    }
  },
})
