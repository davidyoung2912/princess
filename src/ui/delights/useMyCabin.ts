import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'

/** The stateroom number of the current (or next) trip, or null while it is loading or when the room is still to be assigned. */
export function useMyCabin(): string | null {
  const trips = useMine(() => api.trips.list())
  const tripNo = trips.data?.upcoming.find((x) => x.kind === 'current')?.number ?? trips.data?.upcoming[0]?.number
  const booked = useMine(() => (tripNo ? api.booking.get(tripNo) : Promise.resolve(null)), [tripNo])
  return booked.data?.cabin ?? null
}
