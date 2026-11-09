/**
 * "Show this to crew" cards (docs/stanley-gap-analysis-and-plan.md, phase 6): large plain English the guest holds up to a waiter, a steward or a gangway officer.
 * Nothing is read from the guest's health or access records: the guest types the detail, on this phone, and it is shown and never sent anywhere. Pure.
 */
export const CREW_CARDS = ['dietary', 'mobility', 'lostItem', 'lostPassport'] as const
export type CrewCardKind = (typeof CREW_CARDS)[number]
export const CREW_DETAIL_MAX = 120

export interface CrewCard {
  kind: CrewCardKind
  /** The big line. */
  headline: string
  /** What the guest typed, trimmed; empty when they typed nothing. */
  detail: string
  /** The plain request under it. */
  ask: string
}

const HEAD: Record<CrewCardKind, string> = {
  dietary: 'I have a food allergy or dietary need',
  mobility: 'I need help with mobility',
  lostItem: 'I have lost something',
  lostPassport: 'I have lost my passport',
}

const ASK: Record<CrewCardKind, string> = {
  dietary: 'Please tell the chef or the maître d’ before you serve me.',
  mobility: 'Please help me, or call Guest Services for someone who can.',
  lostItem: 'Please take me to Guest Services, or tell them for me.',
  lostPassport: 'Please call Guest Services or Security now.',
}

/** What the guest may type for each card: a hint for the box. */
export const CREW_DETAIL_HINT: Record<CrewCardKind, string> = {
  dietary: 'For example: peanuts, shellfish, gluten',
  mobility: 'For example: wheelchair, cannot use stairs',
  lostItem: 'For example: a blue bag, left in the Atrium',
  lostPassport: 'Leave this empty unless you want to add where you last had it',
}

const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim().slice(0, CREW_DETAIL_MAX)

export function crewCard(kind: CrewCardKind, detail: string): CrewCard {
  return { kind, headline: HEAD[kind], detail: oneLine(detail), ask: ASK[kind] }
}
