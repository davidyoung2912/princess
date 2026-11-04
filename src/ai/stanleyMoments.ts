import type { StanleyLevel } from '../settings/settings'

/** The celebrations (docs/experience-extension-ideas.md 4.3). Each is a stamp, one line and a way on. Pure data, so it is tested in node. */
export type MomentId = 'booked' | 'checkedIn' | 'passReady'
export type StampIcon = 'ticket' | 'clipboard' | 'anchor'

export interface MomentDef {
  id: MomentId
  stamp: StampIcon
  /** Where "what next" goes. */
  to: string
}

export const MOMENTS: readonly MomentDef[] = [
  { id: 'booked', stamp: 'ticket', to: '/home' },
  { id: 'checkedIn', stamp: 'clipboard', to: '/home/boarding-pass' },
  { id: 'passReady', stamp: 'anchor', to: '/home' },
]

export const momentOf = (id: MomentId): MomentDef => MOMENTS.find((m) => m.id === id)!

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
