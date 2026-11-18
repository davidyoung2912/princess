/**
 * Stanley while the guest is off the ship: a small guide that answers on the phone, with no server and no model, about visiting the port and how and when to get
 * back. It never guesses: every answer is picked from what the app already holds for the port day, and anything else gets a plain "I can only help with
 * the port and getting back". The safety screen (`guard.ts`) runs before this, so an emergency never reaches it.
 */
import type { Act } from './understand/lexicon'
import { conceptsOf, understand } from './understand/understand'

export type AwayTopic = 'back' | 'late' | 'taxi' | 'money' | 'say' | 'near' | 'safe' | 'help'

export interface AwayFacts {
  portName: string
  tender: boolean
  /** Ship-time strings, already formatted, e.g. "4:30 pm". */
  allAboard: string
  gangwayBy: string
  sails: string
  /** Whole minutes to all aboard; 0 once it has passed. */
  minutesLeft: number
  /** The ship's phone number and the port's emergency number (null when the port has none). */
  shipPhone: string
  localEmergency: string | null
  agent: string | null
  /** What to tell a driver, in the local language and in English; null when none is kept. */
  takeMeBack: { place: string; say: string; english: string } | null
  taxiStand: string | null
  fare: { route: string; ceiling: number } | null
  firstWalk: { name: string; minutes: number; sit: string; restroom: string } | null
  firstScam: string | null
  firstPhrase: { say: string; means: string } | null
}

/**
 * What each away topic listens for, as concepts of the engine's own lexicon (`understand/lexicon.ts`), so Stanley has one vocabulary on and off the ship. Order matters: being late wins over everything else,
 * then what the guest wants to do about getting around or paying, and the return time is the answer when nothing more specific was asked.
 */
const LISTEN: readonly { topic: AwayTopic; concepts: readonly string[]; acts?: readonly Act[] }[] = [
  { topic: 'late', concepts: ['n.missedship'] },
  { topic: 'taxi', concepts: ['n.taxi'] },
  { topic: 'money', concepts: ['n.currency', 'n.price', 'n.tip', 'n.credit'], acts: ['PRICE'] },
  { topic: 'say', concepts: ['n.language'] },
  { topic: 'near', concepts: ['n.nearby', 'n.restaurant', 'n.meal', 'n.lunch', 'n.dinner', 'n.breakfast', 'n.coffee', 'n.drink', 'n.dessert', 'n.activity', 'n.shop', 'n.sun'] },
  { topic: 'safe', concepts: ['n.scam'] },
  { topic: 'back', concepts: ['n.allaboard', 'n.tender', 'n.embark', 'n.disembark', 'n.nextport', 'a.WHEN'] },
]

/** The topic a question is about, or null when it is about none of them. A problem or loss at the all-aboard time is being late. */
export function awayTopic(text: string): AwayTopic | null {
  const concepts = new Set(conceptsOf(text))
  const acts = new Set(understand(text, {}, (d) => d).acts)
  const lateAtTheShip = concepts.has('n.allaboard') && (acts.has('PROBLEM') || acts.has('LOST'))
  if (lateAtTheShip) return 'late'
  return LISTEN.find((r) => r.concepts.some((c) => concepts.has(c)) || r.acts?.some((a) => acts.has(a)))?.topic ?? null
}

/** The topics offered as buttons, in the order a guest is likely to need them. */
export const AWAY_CHIPS: readonly AwayTopic[] = ['back', 'late', 'taxi', 'near']

export type Say = (key: string, params?: Record<string, string | number>) => string

/**
 * The answer for a topic, from the facts held for the port day. Each says what it can and then repeats the one thing that matters, the return time, so
 * nobody finishes a conversation without it. A missing fact is left out, never invented. `say` turns a key into words (the locale file).
 */
export function awayAnswer(topic: AwayTopic | null, f: AwayFacts, say: Say): string {
  const closing = f.minutesLeft > 0
    ? say('away.s.closing', { port: f.portName, aboard: f.allAboard, by: f.gangwayBy, where: say(f.tender ? 'away.s.where.tender' : 'away.s.where.pier') })
    : say('away.s.closingPast', { phone: f.shipPhone })
  const parts: string[] = []
  switch (topic) {
    case 'late':
      parts.push(say('away.s.late', { phone: f.shipPhone }))
      if (f.agent) parts.push(say('away.s.lateAgent', { agent: f.agent }))
      parts.push(say('away.s.lateDocs'))
      return parts.join(' ')
    case 'taxi':
      if (f.takeMeBack) parts.push(say('away.s.taxiShow', { place: f.takeMeBack.place, say: f.takeMeBack.say }))
      else parts.push(say('away.s.taxiPlain'))
      if (f.taxiStand) parts.push(say('away.s.taxiStand', { stand: f.taxiStand }))
      if (f.fare) parts.push(say('away.s.fare', { route: f.fare.route, ceiling: f.fare.ceiling }))
      break
    case 'money':
      if (f.fare) parts.push(say('away.s.fare', { route: f.fare.route, ceiling: f.fare.ceiling }))
      else parts.push(say('away.s.moneyNone'))
      parts.push(say('away.s.moneyAsk'))
      break
    case 'say':
      parts.push(f.firstPhrase ? say('away.s.phrase', { say: f.firstPhrase.say, means: f.firstPhrase.means }) : say('away.s.phraseNone'))
      break
    case 'near':
      parts.push(f.firstWalk ? say('away.s.walk', { name: f.firstWalk.name, minutes: f.firstWalk.minutes, sit: f.firstWalk.sit, restroom: f.firstWalk.restroom }) : say('away.s.walkNone'))
      break
    case 'safe':
      parts.push(f.firstScam ? say('away.s.scam', { scam: f.firstScam }) : say('away.s.safeNone'))
      if (f.localEmergency) parts.push(say('away.s.emergency', { number: f.localEmergency }))
      break
    case 'back':
      parts.push(say('away.s.back', { aboard: f.allAboard, by: f.gangwayBy, sails: f.sails, where: say(f.tender ? 'away.s.where.tender' : 'away.s.where.pier') }))
      if (f.minutesLeft > 0) parts.push(say('away.s.left', { minutes: f.minutesLeft }))
      return parts.join(' ')
    default:
      parts.push(say('away.s.unknown'))
  }
  parts.push(closing)
  return parts.join(' ')
}
