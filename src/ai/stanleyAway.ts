/**
 * Stanley while the guest is off the ship: a small guide that answers on the phone, with no server and no model, about visiting the port and how and when to get
 * back. It never guesses: every answer is picked from what the app already holds for the port day, and anything else gets a plain "I can only help with
 * the port and getting back". The safety screen (`guard.ts`) runs before this, so an emergency never reaches it.
 */
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

const RULES: readonly { topic: AwayTopic; re: RegExp }[] = [
  { topic: 'late', re: /\b(late|miss(ed|ing)?|left behind|too late|running out of time|not going to make|won'?t make|sailed|sailing without)\b/i },
  { topic: 'taxi', re: /\b(taxi|cab|uber|driver|ride|bus|shuttle|transport)\b/i },
  { topic: 'money', re: /\b(money|cash|price|prices|pay|paying|fare|cost|cheat|overcharg\w*|currency|tip)\b/i },
  { topic: 'say', re: /\b(say|phrase|language|speak|word|words|translate|hello|thank)\b/i },
  { topic: 'near', re: /\b(near|nearby|walk|walking|toilet|restroom|bathroom|sit|bench|lunch|eat|food|what (can|should) i (do|see)|where (can|should) i)\b/i },
  { topic: 'safe', re: /\b(safe|safety|scam|scams|danger\w*|avoid|steal|theft|pickpocket\w*)\b/i },
  { topic: 'back', re: /\b(back|return|time|when|how long|deadline|all aboard|gangway|tender|ship|leave|head)\b/i },
]

/** The topic a question is about, or null when it is about none of them. Order matters: being late wins over everything else. */
export function awayTopic(text: string): AwayTopic | null {
  return RULES.find((r) => r.re.test(text))?.topic ?? null
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
