import type { StageId } from '../domain/sailings'

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
  cozumel: 'port',
  belize: 'port',
  roatan: 'port',
  seaDay2: 'sea',
  farewell: 'sea',
  disembark: 'disembark',
  postCruise: 'remember',
}

/** The one screen to open for each stage of the trip. */
export const STAGE_ACTION: Record<JourneyStage, string> = {
  dream: '/home/quiz',
  discover: '/home/cruise',
  book: '/book',
  manage: '/plan/checklist',
  prebook: '/plan/checklist',
  getToShip: '/plan/getting-there',
  embark: '/home/embarkation',
  sea: '/plan/day',
  port: '/ship/port',
  disembark: '/home/disembark',
  remember: '/me/recap',
}
