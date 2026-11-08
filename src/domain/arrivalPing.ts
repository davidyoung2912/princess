import type { StageId } from './sailings'

export type ArrivalPing = 'before' | 'boarded' | 'atSea' | 'inPort' | 'ashore' | 'home'

/**
 * The gentle line a follower sees: where the trip is, from the ship's stage and place alone.
 * It never says where the guest is, only that the trip has reached this point.
 */
export function arrivalPing(stage: StageId, shipAt: string | null): ArrivalPing {
  switch (stage) {
    case 'booked': case 'preCruise': case 'checkIn': return 'before'
    case 'embarkation': return 'boarded'
    case 'seaDay': case 'portDay': case 'farewell': return shipAt ? 'inPort' : 'atSea'
    case 'disembark': return 'ashore'
    case 'postCruise': return 'home'
  }
}
