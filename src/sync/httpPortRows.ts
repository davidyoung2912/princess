import type { Http } from '../api/http'
import { isApiError } from '../api/errors'
import { normalizeRows } from '../port/rows'
import type { PortRowsRemote } from './portRows'

interface TripsDto { upcoming: { kind: string; number: string }[] }
interface StateDto { data: unknown }

const base = (booking: string): string => `/bookings/${encodeURIComponent(booking)}`

/** The port-row routes (`/bookings/{number}/port-rows`) as a `PortRowsRemote`; the old `port` document is read and deleted through the state routes. */
export const createHttpPortRows = (http: Http): PortRowsRemote => ({
  booking: async () => {
    try {
      const trips = await http.get<TripsDto>('/trips')
      return (trips.upcoming.find((t) => t.kind === 'current') ?? trips.upcoming[0])?.number ?? null
    } catch (e) {
      if (isApiError(e) && e.code === 'notFound') return null
      throw e
    }
  },
  list: async (booking) => normalizeRows(await http.get<unknown>(`${base(booking)}/port-rows`)),
  apply: async (booking, ops) => normalizeRows(await http.post<unknown>(`${base(booking)}/port-rows`, { ops: ops.map((o) => ({ kind: o.kind, key: o.key, data: o.deleted ? null : o.data, at: o.at, deleted: o.deleted })) })),
  legacy: async (booking) => (await http.get<StateDto | null>(`${base(booking)}/state/port`))?.data ?? null,
  dropLegacy: async (booking) => { await http.delete(`${base(booking)}/state/port`) },
})
