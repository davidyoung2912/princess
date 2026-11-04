import type { CabinScore } from './cabinScore'
import { PORT_GUIDES } from './ports'
import { itinerary, portById, shipClockChanges, type Sailing } from './sailings'

/**
 * "What I'd regret" cards (N6.2): one plain line about a choice a guest may wish they had made differently, always with the evidence under it.
 * Cabin cards are read from the server's own scores and reasons; itinerary cards are read from the served timeline, the port guides and the clock changes.
 * A card is never made up: with no evidence there is no card, and none of them is a prompt to buy.
 */
export interface RegretCard { id: string; line: string; evidence: string }

export const MAX_CABIN_REGRETS = 3

const WEAK = 2

/** Minutes between two "HH:MM" times on the same day. */
const minutesBetween = (from: string, to: string): number => {
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
  return m(to) - m(from)
}

const hoursWord = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} hours` : `${h} hours ${m} minutes`
}

/** What a guest might regret about a stateroom, worst first and at most three. Each card quotes the first reason the server gave. */
export function cabinRegrets(score: CabinScore): RegretCard[] {
  const out: RegretCard[] = []
  const { cabin } = score
  if (cabin.obstructed) out.push({ id: 'view', line: 'You may regret paying for a view that is partly blocked.', evidence: `Stateroom ${cabin.number} on deck ${cabin.deck}: view partly blocked by lifeboats.` })
  if (score.noise <= WEAK && score.reasons.noise[0]) out.push({ id: 'noise', line: 'You may regret a light sleeper’s choice of stateroom.', evidence: `Noise ${score.noise} of 5: ${score.reasons.noise[0]}` })
  if (score.motion <= WEAK && score.reasons.motion[0]) out.push({ id: 'motion', line: 'You may regret this spot if the sea is rough.', evidence: `Motion ${score.motion} of 5: ${score.reasons.motion[0]}` })
  if (score.sleep <= WEAK && score.reasons.sleep[0]) out.push({ id: 'sleep', line: 'You may regret this stateroom on the nights you want to sleep in.', evidence: `Sleep ${score.sleep} of 5: ${score.reasons.sleep[0]}` })
  if (score.category === 'interior') out.push({ id: 'window', line: 'You may regret having no window if you wake early.', evidence: 'An inside stateroom has no window or balcony.' })
  return out.slice(0, MAX_CABIN_REGRETS)
}

/** What a guest might regret about the route and the days on it, from the timeline the server serves. */
export function itineraryRegrets(sailing: Sailing): RegretCard[] {
  const days = itinerary(sailing)
  const out: RegretCard[] = []

  for (const d of days) {
    if (d.port === 'sea' || d.day === 1 || d.day === days.length) continue
    const guide = PORT_GUIDES[d.port]
    const name = portById(d.port)?.name ?? guide?.short ?? d.port
    if (guide?.landing === 'tender' || portById(d.port)?.tender) out.push({ id: `tender-${d.port}`, line: `You may regret leaving ${name} until the last tender.`, evidence: `${name} day ${d.day}: the ship anchors off shore and guests go in by tender boat.` })
    if (d.arrive && d.depart) {
      const stay = minutesBetween(d.arrive, d.depart)
      if (stay > 0 && stay <= 8 * 60) out.push({ id: `short-${d.port}`, line: `You may regret a slow start in ${name}.`, evidence: `${name} day ${d.day}: the ship is in port ${hoursWord(stay)}, ${d.arrive} to ${d.depart} local time.` })
    }
  }

  const seaDays = days.filter((d) => d.port === 'sea').length
  if (seaDays >= 2) out.push({ id: 'sea', line: 'You may regret leaving the sea days unplanned.', evidence: `${seaDays} of ${days.length} days are at sea.` })

  const changes = shipClockChanges(sailing).filter((c) => c.hours !== 0)
  if (changes.length > 0) out.push({ id: 'clock', line: 'You may regret trusting your phone’s clock.', evidence: changes.map((c) => `The ship’s clock moves ${Math.abs(c.hours)} hour${Math.abs(c.hours) === 1 ? '' : 's'} ${c.hours < 0 ? 'back' : 'forward'} overnight.`).join(' ') })
  return out
}
