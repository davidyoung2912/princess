import type { OnboardToday } from '../api/types'
import { heroEffect, phaseOfDay, seaState, type HeroEffect, type PhaseOfDay, type SeaState } from '../domain/shipLook'
import { skyNightFeed } from '../feeds/skyNight'
import { weatherFeed } from '../feeds/weather'
import { useNow, useSailing } from './useDemo'
import { useServedFeed } from './useServedFeeds'

const HOUR = 3_600_000

export interface ShipLook {
  phase: PhaseOfDay
  /** Minutes to the sun event of a sunrise or sunset phase (negative after it). */
  minutes: number | null
  sunrise: string | null
  sunsetSide: 'port' | 'starboard' | 'neither' | null
  effect: HeroEffect
  sea: SeaState | null
}

/** What the ship looks like right now for the Home hero: the part of the day from the server's sun times, and the light effect and sea state from the server's weather. Falls back to plain day while the feeds have not come. */
export function useShipLook(today: OnboardToday | null | undefined): ShipLook {
  const now = useNow()
  const sailing = useSailing()
  const on = !!today?.aboard && today.day !== null
  const sky = useServedFeed(on, skyNightFeed, [sailing.id, today?.day ?? 1])
  const wx = useServedFeed(on, weatherFeed, [sailing.id, Math.floor(now / HOUR) * HOUR])
  const p = sky && today ? phaseOfDay(now, today.date, today.shipZone, sky) : { phase: 'day' as const, minutes: null }
  const forecast = wx ? (wx.forecast.find((d) => d.day === wx.day) ?? wx.forecast[0]) : undefined
  const sea = forecast ? seaState(forecast.waveM) : null
  return {
    phase: p.phase, minutes: p.minutes, sunrise: sky?.sunrise ?? null, sunsetSide: sky?.sunsetSide ?? null,
    effect: wx && sea ? heroEffect(wx.current.condition, sea, wx.current.daylight) : 'none', sea,
  }
}
