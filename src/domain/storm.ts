/**
 * Storm watch (S3-04): the shapes of the server's reading (`GET /feeds/storm`). A plain, calm reading of how likely a named storm is to touch this
 * sailing's route; it is not a forecast and never says "a storm is coming". The chances are worked out on the server. `source: 'sim'`.
 */
export type StormBand = 'none' | 'low' | 'some' | 'higher'
export type StormPhase = 'far' | 'watch' | 'near' | 'sailing'

export interface StormReading {
  source: 'sim'
  departure: string
  returns: string
  inSeason: boolean
  percent: number
  band: StormBand
  phase: StormPhase
  /** Text key suffixes for what the line may do, and what the guest can do. */
  lineMay: string[]
  youCan: string[]
  /** Whether the dates reach the busiest weeks (September). */
  peak: boolean
}
