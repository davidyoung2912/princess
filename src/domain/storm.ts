import { addDays } from './timezones'
import { isHurricaneSeason } from './readiness'
import type { Sailing } from './sailings'

/**
 * Storm watch (S3-04). A plain, calm reading of how likely a named storm is to touch this sailing's route, from authored typical chances by month.
 * It is not a forecast and never says "a storm is coming": that comes from the National Hurricane Center and the line. `source: 'sim'`. Pure.
 */
export const SAILING_NIGHTS = 7

/** The authored chance (percent) that a named storm affects some part of a seven-night Western Caribbean route, by month (January first). */
export const MONTH_CHANCE: readonly number[] = [0, 0, 0, 0, 0, 2, 4, 8, 15, 10, 3, 0]

export type StormBand = 'none' | 'low' | 'some' | 'higher'
export const bandFor = (percent: number): StormBand => (percent <= 0 ? 'none' : percent < 5 ? 'low' : percent < 12 ? 'some' : 'higher')

export type StormPhase = 'far' | 'watch' | 'near' | 'sailing'
export const phaseFor = (daysToDeparture: number): StormPhase => (daysToDeparture <= 0 ? 'sailing' : daysToDeparture <= 3 ? 'near' : daysToDeparture <= 14 ? 'watch' : 'far')

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

const LINE_MAY = ['reroute', 'swap', 'shorten', 'delay', 'cancel'] as const
const YOU_CAN = ['insurance', 'flights', 'early', 'follow', 'plan'] as const

export function stormWatch(sailing: Sailing, daysToDeparture: number): StormReading {
  const returns = addDays(sailing.departure, SAILING_NIGHTS)
  const months = [Number(sailing.departure.slice(5, 7)) - 1, Number(returns.slice(5, 7)) - 1]
  const percent = Math.max(...months.map((m) => MONTH_CHANCE[m] ?? 0))
  const inSeason = isHurricaneSeason(sailing.departure) || isHurricaneSeason(returns)
  const band = bandFor(percent)
  return {
    source: 'sim', departure: sailing.departure, returns, inSeason, percent, band, phase: phaseFor(daysToDeparture),
    lineMay: band === 'none' ? [] : [...LINE_MAY],
    youCan: band === 'none' ? [] : band === 'low' ? YOU_CAN.slice(0, 2) : [...YOU_CAN],
    peak: months.includes(8),
  }
}
