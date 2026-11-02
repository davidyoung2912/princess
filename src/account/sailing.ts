import { SAILINGS, sailingById, type Sailing } from '../domain/sailings'
import type { AccountContext } from './context'

/** The first sailing that has not left yet (the last one when all have): where a real account with no trip browses from. */
export function upcomingSailing(now: number): Sailing {
  const today = new Date(now).toISOString().slice(0, 10)
  return SAILINGS.find((s) => s.departure >= today) ?? SAILINGS[SAILINGS.length - 1]
}

/**
 * The sailing the app is on. A real account follows its trip (else the next sailing); a demo account follows its demo controls, which the server
 * keeps for it. A sailing the catalogue does not know falls back the same way, so a screen always has one.
 */
export function sailingFor(context: AccountContext | null, demoSailingId: string, now: number): Sailing {
  if (context && !context.isDemo) return sailingById(context.sailingId) ?? upcomingSailing(now)
  return sailingById(demoSailingId) ?? upcomingSailing(now)
}
