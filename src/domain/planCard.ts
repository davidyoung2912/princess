import { MAX_PLAN_DAY } from './nightsRules'
import { PASTE_LINE_MAX, PASTE_MAX, type PlanLine } from './prepMore'

/**
 * Chat plan cards (C01): "meet at the Piazza at 7 pm" sent in the party chat as a card with an "add to my plan" button. A card travels as
 * ordinary message text: a readable sentence, then a marker the app turns into a card. A phone that does not know the marker shows the sentence.
 */
export interface PlanCard { day: number; time: string; place: string }

export const PLACE_MAX = 60
const MARKER = /^([\s\S]*?)\s*⟦plan\|(\d{1,2})\|(\d{2}:\d{2})\|([^⟦⟧|]{1,60})⟧$/

const cleanPlace = (v: string): string => v.replace(/[⟦⟧|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, PLACE_MAX)
const validTime = (v: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

/** "19:00" as "7:00 PM". */
export function clock12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** A card from typed input, or null for a missing place, a bad time or a day out of range. */
export function newPlanCard(day: number, time: string, place: string): PlanCard | null {
  const p = cleanPlace(place)
  return Number.isInteger(day) && day >= 1 && day <= MAX_PLAN_DAY && validTime(time) && p ? { day, time, place: p } : null
}

/** The sentence that says what the card says. */
export const planCardSentence = (c: PlanCard): string => `Meet at ${c.place} at ${clock12(c.time)} on day ${c.day}.`

/** The message text for a card. */
export const encodePlanCard = (c: PlanCard): string => `${planCardSentence(c)} ⟦plan|${c.day}|${c.time}|${c.place}⟧`

/** The card in a message's text, or null when it carries none. */
export function parsePlanCard(text: string): PlanCard | null {
  const m = MARKER.exec(text.trim())
  return m ? newPlanCard(Number(m[2]), m[3], m[4]) : null
}

/** The line a card adds to the guest's own plan. */
export const planCardLine = (c: PlanCard): PlanLine => ({ day: c.day, text: `${clock12(c.time)}, meet at ${c.place}`.slice(0, PASTE_LINE_MAX) })

/** Whether the guest already has this card in their plan. */
export const hasPlanCard = (lines: readonly PlanLine[], c: PlanCard): boolean => lines.some((l) => l.day === c.day && l.text === planCardLine(c).text)

/** The guest's plan lines with the card added; unchanged when it is already there or the list is full. */
export function addPlanCard(lines: readonly PlanLine[], c: PlanCard): PlanLine[] {
  return hasPlanCard(lines, c) || lines.length >= PASTE_MAX ? [...lines] : [...lines, planCardLine(c)]
}
