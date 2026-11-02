/**
 * Guardrails (requirements §22.2). Some messages are never answered by a model: an emergency, medical, legal or
 * safety-critical question goes straight to a person, with the numbers to use. Checked on the guest's words before
 * anything is sent anywhere.
 */
export type Handoff = 'emergency' | 'medical' | 'legal' | 'person'

const EMERGENCY = /\b(fire|smoke|overboard|drown\w*|can'?t breathe|cannot breathe|not breathing|chest pain|heart attack|stroke|unconscious|bleeding|overdose|seizure|choking|collapsed|assault\w*|attack\w*|missing child|lost child|suicid\w*|help me now|emergency)\b/i
const MEDICAL = /\b(medic\w*|dose|dosage|prescription|doctor|diagnos\w*|symptom\w*|pregnan\w*|allerg\w* (reaction|shock)|infection|rash|fever|vomit\w*|norovirus|covid|seasick\w*|is it safe to (take|drink|eat))\b/i
const LEGAL = /\b(lawyer|attorney|sue|lawsuit|legal advice|liability|compensation claim|injur\w+ claim|insurance claim|contract dispute)\b/i
const PERSON = /\b(talk to (a )?(person|human|agent|someone)|speak to (a )?(person|human|agent|someone)|real person|human agent|guest services|customer service|supervisor|manager)\b/i

/** Which kind of handoff a message needs, or null when the concierge may answer. Emergency wins over the rest. */
export function screen(message: string): Handoff | null {
  if (EMERGENCY.test(message)) return 'emergency'
  if (MEDICAL.test(message)) return 'medical'
  if (LEGAL.test(message)) return 'legal'
  if (PERSON.test(message)) return 'person'
  return null
}

/** The longest message accepted, so one paste cannot run up a large request. */
export const MAX_MESSAGE = 500
/** Messages sent in one request, newest last; older ones stay on screen but are not sent. */
export const MAX_CONTEXT = 12
