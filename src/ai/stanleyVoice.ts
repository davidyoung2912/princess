import { speechRecognitionOf } from '../domain/finishMore'
import { assistantMobility } from '../domain/bookingPrep'
import type { AccessProfile, AllergyFlag } from '../domain/bookingPrep'
import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from '../domain/contacts'
import type { Card } from '../domain/export'
import type { StanleyCard } from './stanleyCard'

/**
 * Voice and the pocket card for Stanley (docs/stanley-gap-analysis-and-plan.md, phase 15). Framework-free, so it can be tested in node.
 * Voice only fills the question box (sending is still a tap) and read-aloud only speaks what is already on screen; nothing is recorded or sent by this code.
 */

/** What the device can do by voice, from its window. Both are optional and the dialog works the same without them. */
export function voiceSupport(win: object | undefined): { listen: boolean; speak: boolean } {
  return { listen: speechRecognitionOf(win) !== null, speak: !!win && 'speechSynthesis' in win }
}

/** Adds what was heard to what is already typed, with one space between, and never past the limit. A blank transcript changes nothing. */
export function appendTranscript(draft: string, heard: string, max: number): string {
  const said = heard.replace(/\s+/g, ' ').trim()
  if (said === '') return draft
  const base = draft.trimEnd()
  return (base === '' ? said : `${base} ${said}`).slice(0, max)
}

/** The words of an answer as they should be spoken: no web addresses, no markdown marks, and a pause (a full stop) at the end of each line. */
export function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>]+/g, '')
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l !== '')
    .map((l) => (/[.!?:]$/.test(l) ? l : `${l}.`))
    .join(' ')
}

/** A card read aloud: the title, the lines, and an honest word when it could not confirm or is a saved copy. */
export function cardSpeech(card: StanleyCard, notes: { abstained: string; cached: string }): string {
  const tail = card.abstained ? notes.abstained : card.provenance.freshness === 'cached' ? notes.cached : ''
  return speakable([card.title, ...card.lines, tail].join('\n'))
}

// ---- Pocket card ----

export interface PocketInput {
  title: string
  /** The ship and sailing line, as the screen shows it. */
  subtitle: string
  /** Trip facts the device already keeps (boarding, tours, dinners, stateroom), as the server's cards. */
  facts: readonly StanleyCard[]
  access: AccessProfile
  allergy: AllergyFlag
  words: { facts: string; contacts: string; guest: string; emergency: string; needs: string; allergy: string; step: string; wheels: string; none: string; foot: string }
}

/** At most this many facts and lines are put on the one page, so it stays a pocket card. */
export const POCKET_FACTS = 6
export const POCKET_LINES = 3

/**
 * One page for the pocket, printable and large-print friendly: key facts first, then who to call, then what the crew should know (mobility and allergies the guest has already chosen to keep).
 * Nothing is added that the guest has not saved; a card that could not confirm is left out rather than printed as fact.
 */
export function pocketCard(i: PocketInput, large = false): Card {
  const lines: string[] = []
  const facts = i.facts.filter((c) => !c.abstained).slice(0, POCKET_FACTS)
  for (const c of facts) lines.push(`${c.title}: ${c.lines.slice(0, POCKET_LINES).join('; ')}`)
  lines.push(`${i.words.guest}: ${GUEST_SERVICES_NUMBER}`, `${i.words.emergency}: ${EMERGENCY_NUMBER}`)
  const needs: string[] = []
  const mobility = assistantMobility(i.access)
  if (mobility === 'wheelchair') needs.push(i.words.wheels)
  else if (mobility === 'easy') needs.push(i.words.step)
  if (i.allergy.items.length > 0) needs.push(`${i.words.allergy}: ${i.allergy.items.join(', ')}`)
  lines.push(`${i.words.needs}: ${needs.length > 0 ? needs.join('; ') : i.words.none}`)
  return { id: 'pocket', title: i.title, subtitle: i.subtitle, lines, footer: i.words.foot, large }
}

/** The day as a one-page card in time order, for printing in large type. Dropped items are left out; a day the server has not sent yet says so rather than looking free. */
export function dayPlanCard(i: { title: string; subtitle: string; rows: readonly { state: string; entry: { start: string; title: string } }[]; ready: boolean; words: { empty: string; waiting: string; foot: string } }, large = true): Card {
  const lines = i.rows.filter((r) => r.state !== 'dropped').map((r) => r.entry).sort((a, b) => a.start.localeCompare(b.start)).map((e) => `${e.start}  ${e.title}`)
  return { id: 'day-plan', title: i.title, subtitle: i.subtitle, lines: !i.ready ? [i.words.waiting] : lines.length > 0 ? lines : [i.words.empty], footer: i.words.foot, large }
}
