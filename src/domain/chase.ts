import { formatMoney, type Cents } from './money'

export type ChaseTone = 'friendly' | 'neutral' | 'firm'
export const CHASE_TONES: readonly ChaseTone[] = ['friendly', 'neutral', 'firm']

/** A polite reminder for one person who has not paid their share, in one of three tones. It is copied or shared, never sent by the app. */
export function chaseText(tone: ChaseTone, first: string, amount: Cents, link: string, due: string): string {
  const money = formatMoney(amount)
  const ask = link === '' ? '' : ` You can pay here: ${link}`
  if (tone === 'friendly') return `Hi ${first}! Just a little nudge about your ${money} share of the cruise, due ${due}.${ask} Thank you so much!`
  if (tone === 'neutral') return `Hi ${first}, a reminder that your share of the cruise is ${money}, due ${due}.${ask}`
  return `Hi ${first}, your ${money} share of the cruise is still unpaid and is due ${due}. Please pay it as soon as you can.${ask}`
}
