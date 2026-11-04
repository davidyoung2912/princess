import type { StanleyLevel } from '../settings/settings'
import type { DiaryKind } from '../domain/tripDiary'

/** The celebrations (docs/experience-extension-ideas.md 4.3). Each is a stamp, one line and a way on. Pure data, so it is tested in node. */
export type MomentId = 'booked' | 'checkedIn' | 'passReady' | 'docsReady' | 'medallion' | 'muster' | 'sailAway' | 'port' | 'lastNight' | 'offShip' | 'home'
export type StampIcon = 'ticket' | 'clipboard' | 'anchor' | 'fileCheck' | 'medallion' | 'megaphone' | 'sunset' | 'pin' | 'moon' | 'logOut' | 'house'

/** The Trip Diary line a moment can add (the key and kind match the lines the diary writes by itself, so a moment never makes a second one). */
export interface MomentDiary {
  kind: DiaryKind
  key: string
}

export interface MomentDef {
  id: MomentId
  stamp: StampIcon
  /** Where "what next" goes. */
  to: string
  diary: MomentDiary
}

export const MOMENTS: readonly MomentDef[] = [
  { id: 'booked', stamp: 'ticket', to: '/home', diary: { kind: 'booked', key: 'booked' } },
  { id: 'docsReady', stamp: 'fileCheck', to: '/home/check-in', diary: { kind: 'docs', key: 'moment:docs' } },
  { id: 'checkedIn', stamp: 'clipboard', to: '/home/boarding-pass', diary: { kind: 'checkedIn', key: 'checkedIn' } },
  { id: 'passReady', stamp: 'anchor', to: '/home', diary: { kind: 'pass', key: 'pass' } },
  { id: 'medallion', stamp: 'medallion', to: '/ship/muster', diary: { kind: 'moment', key: 'moment:medallion' } },
  { id: 'muster', stamp: 'megaphone', to: '/ship', diary: { kind: 'moment', key: 'moment:muster' } },
  { id: 'sailAway', stamp: 'sunset', to: '/me/diary', diary: { kind: 'moment', key: 'moment:sail' } },
  { id: 'port', stamp: 'pin', to: '/ship', diary: { kind: 'moment', key: 'moment:port' } },
  { id: 'lastNight', stamp: 'moon', to: '/home/disembark/bags', diary: { kind: 'moment', key: 'moment:lastNight' } },
  { id: 'offShip', stamp: 'logOut', to: '/home/disembark/customs', diary: { kind: 'moment', key: 'moment:off' } },
  { id: 'home', stamp: 'house', to: '/me/memories', diary: { kind: 'moment', key: 'moment:home' } },
]

export const momentOf = (id: MomentId): MomentDef => MOMENTS.find((m) => m.id === id)!

/** The diary key for a moment about one thing: a port is stamped once for each day of the trip (`moment:port:3`), the rest are once for the trip. */
export const momentDiaryKey = (id: MomentId, subject: string): string => {
  const base = momentOf(id).diary.key
  return id === 'port' ? `${base}:${subject}` : base
}

/** Moments are celebrations Stanley starts, so they show at Helpful and Chatty only (calm and simple mode cap the level at "asked", which removes them). */
export const momentsShow = (level: StanleyLevel): boolean => level === 'chatty' || level === 'helpful'

/** A moment plays once per thing it is about (a booking number, say). */
export const momentKey = (id: MomentId, subject: string): string => `${id}:${subject}`

export const COACH_SCREENS = ['P34', 'S01', 'H31', 'S37', 'M10'] as const
export type CoachScreen = (typeof COACH_SCREENS)[number]

/** How many steps each tour has (the words are `stanley.coach.<screen>.<n>.title` and `.body`). */
export const COACH_STEPS: Readonly<Record<CoachScreen, number>> = { P34: 3, S01: 3, H31: 3, S37: 3, M10: 3 }

export const hasCoach = (screenId: string | undefined): screenId is CoachScreen => !!screenId && (COACH_SCREENS as readonly string[]).includes(screenId)

/** The tour shows by itself only at Chatty, and the guest can always ask for it again unless Stanley is Off. */
export const coachAutoShows = (level: StanleyLevel): boolean => level === 'chatty'
export const coachCanReplay = (level: StanleyLevel): boolean => level !== 'off'
