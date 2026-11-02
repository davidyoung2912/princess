import { buildRecap, type Recap } from '../domain/recap'
import { partyOf } from '../domain/personas'
import { api } from '../runtime'
import { useSailing } from './useDemo'
import { useMine, type Mine } from './useMine'
import { usePersona } from './useDemo'

/** The recap of the signed-in person's cruise, from what they booked and kept (the same facts as the trip memories page). */
export function useRecapData(): Mine<Recap> {
  const sailing = useSailing()
  const me = usePersona()
  return useMine(async () => {
    const [tours, dining, photos] = await Promise.all([api.plan.excursions.list(), api.plan.dining.view(), api.photos.list()])
    return buildRecap({
      sailing,
      party: me ? partyOf(me.id).map((p) => p.firstName) : [],
      tours: tours.booked.filter((b) => b.status === 'booked').map((b) => b.excursionId),
      dinners: dining.reservations.map((r) => r.venueId),
      photos: photos.photos.length,
    })
  }, [sailing.id])
}
