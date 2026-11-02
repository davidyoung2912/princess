import { EMBARK } from './boarding'
import { PORT_FACTS } from './travel'

/**
 * The meeting-point card (N6.4): what to say to the person who drops a guest at the terminal or collects them from it.
 * It is plain text built on the device from the address already in the app and the few things the guest types, so it can be copied into any message
 * and shows on a printed page. No picture is used; the landmark is described in words. It is not a link: nothing is stored or sent from here.
 * The landmark wording is authored (verify with the port before real use).
 */
export type MeetKind = 'dropoff' | 'pickup'
export const MEET_KINDS: readonly MeetKind[] = ['dropoff', 'pickup']
export const isMeetKind = (v: unknown): v is MeetKind => MEET_KINDS.includes(v as MeetKind)

export const MEET_NOTE_MAX = 200
export const MEET_PHONE_MAX = 24
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
/** Digits with the usual spacing and a leading plus; no letters, so the card cannot carry a stray message in the phone line. */
const PHONE = /^\+?[0-9][0-9 ()-]*$/

export interface MeetInput { kind: MeetKind; time: string; phone: string; note: string }

export type MeetProblem = 'time' | 'phone' | 'note' | null

export function meetProblem(input: MeetInput): MeetProblem {
  if (!HHMM.test(input.time)) return 'time'
  const phone = input.phone.trim()
  if (phone !== '' && (phone.length > MEET_PHONE_MAX || !PHONE.test(phone))) return 'phone'
  if (input.note.trim().length > MEET_NOTE_MAX) return 'note'
  return null
}

/** The landmark for each kind, in words a driver can follow without a picture. */
export const LANDMARK: Record<MeetKind, string> = {
  dropoff: 'Drive to the terminal building and stop at the curb outside the entrance. Porters stand at the curb and take the bags; the guest walks in from there.',
  pickup: 'Wait at the curb outside the terminal building, on the same side as the entrance the guests walk out of. Stay with the car; the guest will come to you.',
}

const clock = (time: string): string => {
  const h = Number(time.slice(0, 2))
  return `${h % 12 === 0 ? 12 : h % 12}:${time.slice(3)} ${h < 12 ? 'AM' : 'PM'}`
}

export interface MeetCard { heading: string; lines: string[] }

/** The card's lines, or null when the entries have a problem. Empty optional lines are left out, never shown as blanks. */
export function meetCard(input: MeetInput): MeetCard | null {
  if (meetProblem(input) !== null) return null
  const drop = input.kind === 'dropoff'
  const lines = [
    `Where: ${PORT_FACTS.name}, ${PORT_FACTS.address}`,
    `Which terminal: ${EMBARK.mapQuery.includes('Terminal 2') ? 'Terminal 2, unless check-in says another' : 'as confirmed at check-in'}`,
    `${drop ? 'Be there by' : 'Pick-up from'}: ${clock(input.time)}`,
    `What to look for: ${LANDMARK[input.kind]}`,
  ]
  lines.push(`Map: ${meetMapUrl()}`)
  if (input.phone.trim()) lines.push(`Ring on arrival: ${input.phone.trim()}`)
  if (input.note.trim()) lines.push(`Also: ${input.note.trim()}`)
  return { heading: drop ? 'Drop-off at the cruise terminal' : 'Pick-up at the cruise terminal', lines }
}

export const meetText = (card: MeetCard): string => `${card.heading}\n${card.lines.join('\n')}`

/** A map link for the address, for the driver to open in their own maps app. */
export const meetMapUrl = (): string => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(EMBARK.mapQuery)}`
