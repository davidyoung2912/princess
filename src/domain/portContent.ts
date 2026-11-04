/**
 * Authored port knowledge (S6A-03, S6A-07 to S6A-13): fair prices, scam alerts, phrases, safety, local rules, walks, day passes, family notes and
 * local vendors. Every value is an authored concept sample: verify prices, rules and hours before real use. Nothing here earns a commission,
 * and vendors are listed in a fixed order (XT-08).
 */
export type GuidePort = 'cozumel' | 'belize' | 'roatan'
export const GUIDE_PORTS: readonly GuidePort[] = ['cozumel', 'belize', 'roatan']
export const isGuidePort = (x: unknown): x is GuidePort => GUIDE_PORTS.includes(x as GuidePort)

export interface FairPrice { route: string; /** US dollars for the whole car, up to four people. */ car: number; /** Do not pay more than this. */ ceiling: number }
export interface Phrase { say: string; means: string; /** How it sounds, plainly. */ sounds: string }
export interface AllergyCard { allergy: string; language: string; /** BCP 47 code for the card's text; Spanish when absent. */ lang?: string; text: string; english: string }
export interface Walk { id: string; name: string; minutes: number; step: string; accessible: string; sit: string; restroom: string }
export interface DayPass { id: string; name: string; price: number; distance: string; crowd: 'quiet' | 'moderate' | 'busy' }
export interface Vendor { name: string; what: string }

export interface PortKnowledge {
  /** Language of the phrases (BCP 47); Spanish when absent. */
  lang?: string
  fairPrices: readonly FairPrice[]
  taxiStand: string
  scams: readonly string[]
  phrases: readonly Phrase[]
  etiquette: readonly string[]
  allergy: readonly AllergyCard[]
  advisories: readonly string[]
  laws: readonly string[]
  dontBringBack: readonly string[]
  walks: readonly Walk[]
  dayPasses: readonly DayPass[]
  kids: readonly string[]
  vendors: readonly Vendor[]
  souvenirs: readonly { item: string; fair: string }[]
}

export const PORT_KNOWLEDGE: Record<GuidePort, PortKnowledge> = {} as Record<GuidePort, PortKnowledge>

/** Whether a quoted fare is over the line. */
export const overCeiling = (quoted: number, p: FairPrice): boolean => quoted > p.ceiling

/** The most a guest should pay for a route given how many people share the car; per-person prices stay under the car ceiling. */
export const perPerson = (p: FairPrice, people: number): number => Math.round((p.car / Math.max(1, Math.min(4, people))) * 100) / 100

/** Replaces the port knowledge in place (`portsServed.ts`), so earlier imports see the served values. */
export function replacePortKnowledge(next: Record<string, PortKnowledge>): void {
  const k = PORT_KNOWLEDGE as Record<string, PortKnowledge>
  for (const id of Object.keys(k)) delete k[id]
  Object.assign(k, next)
}
