import { COPPA_AGE, RETENTION, consentsFor } from './privacy'

/**
 * How health data and children's data are handled (SEC-07, SEC-08). The rules are written down here and checked by tests, and the
 * privacy centre shows them. They describe what the concept does with its stored records; a real service would hold the same
 * rules in its server and its contracts.
 */
export type Sensitivity = 'health' | 'minor'

export interface DataRule {
  id: string
  sensitivity: Sensitivity
  /** The stored record kind, or "" for a rule about behaviour rather than a record. */
  kind: string
  title: string
  /** Who can read it. */
  seenBy: string
  /** What is collected, and what is left out on purpose. */
  minimal: string
  /** What the person can do about it. */
  control: string
}

export const DATA_RULES: readonly DataRule[] = [
  {
    id: 'illness', sensitivity: 'health', kind: 'illness', title: 'Illness reports',
    seenBy: 'The person who reported, and ship medical staff while they care for you. Nobody else on the booking.',
    minimal: 'What you tell us about your symptoms and when they began. No diagnosis, insurance number or history is asked for.',
    control: 'Deleted 90 days after the cruise. The access log shows every time it is opened.',
  },
  {
    id: 'clubReg', sensitivity: 'health', kind: 'clubReg', title: 'Kids’ and teens’ club registration',
    seenBy: 'The adult who holds the booking, and club staff at the club. A supervised child account cannot open it. Other bookings cannot see it.',
    minimal: 'Allergies, medical needs and medicines, each optional and limited to 300 characters. No medical documents or insurance details.',
    control: 'Change or withdraw it at any time on the Clubs screen. Deleted 90 days after the cruise.',
  },
  {
    id: 'held', sensitivity: 'health', kind: '', title: 'Kept apart from everything else',
    seenBy: 'Health records are stored under their own kind and are not part of search, recaps, chat, notifications or the demo backup summary.',
    minimal: 'The concept never copies health details into a message, a push notice or a printed pass.',
    control: 'The privacy centre lists when each kind is deleted.',
  },
  {
    id: 'supervised', sensitivity: 'minor', kind: '', title: 'A child’s account is supervised',
    seenBy: 'A parent or guardian holds the account. A child can read their own plans but cannot change the account, pay, or write to the crew.',
    minimal: 'Under 13, only the parent’s consent and ship photos are ever asked about. Marketing is never offered to a child.',
    control: 'The parent decides every choice for their child in the privacy centre.',
  },
  {
    id: 'photos', sensitivity: 'minor', kind: '', title: 'Photos of children',
    seenBy: 'Ship photos of a child are used only when the parent turns that on. Chat photos are blocked for under-18 accounts without a parent’s account.',
    minimal: 'Club photo consent starts off and is a separate choice on each child’s registration.',
    control: 'The parent can turn photo consent off at any time; the club stops using photos from then on.',
  },
  {
    id: 'contact', sensitivity: 'minor', kind: '', title: 'No contact details from children',
    seenBy: 'Phone numbers, emails and links are blocked in a child’s chat messages.',
    minimal: 'The concept asks a child for a name and an age, and nothing else.',
    control: 'A parent can ask Guest Services to remove anything a child has shared.',
  },
]

/** The age below which the strictest rules apply (COPPA). */
export const MINOR_STRICT_AGE = COPPA_AGE

/** Problems with the rules themselves: a health record with no deletion date, or text missing. Empty when sound. */
export function dataRuleProblems(): string[] {
  const out: string[] = []
  const kept = new Map(RETENTION.filter((r) => r.days !== null).flatMap((r) => r.kinds.map((k) => [k, r.days] as const)))
  const seen = new Set<string>()
  for (const r of DATA_RULES) {
    if (seen.has(r.id)) out.push(`duplicate rule ${r.id}`)
    seen.add(r.id)
    if (!r.title || !r.seenBy || !r.minimal || !r.control) out.push(`${r.id} is missing text`)
    if (r.sensitivity === 'health' && r.kind && !kept.has(r.kind)) out.push(`${r.id}: ${r.kind} has no deletion date`)
  }
  for (const age of [0, 5, MINOR_STRICT_AGE - 1]) {
    if (consentsFor(age).some((c) => c.id === 'marketingEmail' || c.id === 'marketingSms' || c.id === 'improve')) out.push(`age ${age} is asked about marketing`)
  }
  return out
}
