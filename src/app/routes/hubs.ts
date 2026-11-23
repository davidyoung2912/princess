import type { StageId } from '../../domain/sailings'

/** The eleven stages of a guest's journey (customer-journey-priorities.md), in order. */
export const JOURNEY_STAGES = ['dream', 'discover', 'book', 'manage', 'prebook', 'getToShip', 'embark', 'sea', 'port', 'disembark', 'remember'] as const
export type JourneyStage = (typeof JOURNEY_STAGES)[number]

/** The journey stage a point on the sailing falls in. */
export const JOURNEY_OF_STAGE: Record<StageId, JourneyStage> = {
  booked: 'manage',
  preCruise: 'prebook',
  checkIn: 'getToShip',
  embarkation: 'embark',
  seaDay: 'sea',
  portDay: 'port',
  farewell: 'sea',
  disembark: 'disembark',
  postCruise: 'remember',
}
