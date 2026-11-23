import { hasText } from '../i18n'
import { dismissTipIn, resetTipsIn } from './hintsState'
import { getHints, hintsLoaded, subscribeHints, updateHints } from './hints'

/** Which page's tips to show: its screen id, or for a tab landing page the tab's key. Null when the page has none. */
export function tipIdFor(screenId: string | undefined, tabKey: string | undefined): string | null {
  if (screenId) return screenId
  return tabKey ? `tab.${tabKey}` : null
}

/** The text key of a page's nth tip (1-based): `tip.H02` for the first, `tip.H02.2` for the second, and so on. */
export const tipKeyAt = (id: string, n: number): string => (n === 1 ? `tip.${id}` : `tip.${id}.${n}`)

/** True when a tip is written for this page and number. */
export const hasTip = (id: string, n = 1): boolean => hasText(tipKeyAt(id, n))

/** How many tips a page has: they are numbered without gaps from 1. */
export function tipCount(id: string): number {
  let n = 0
  while (hasTip(id, n + 1)) n++
  return n
}

/** How many of each page's tips the signed-in guest has dismissed. These are kept on their account, so they follow them to every device. */
export const loadTipProgress = (): Readonly<Record<string, number>> => getHints().tips

/** True once the account's copy has arrived, so a dismissal made on another device is known before a tip is shown. */
export const tipsReady = hintsLoaded

export const subscribeTips = subscribeHints

/** Dismisses the tip now showing on a page, so its next one (if any) shows. */
export function dismissTip(id: string): void { updateHints((h) => dismissTipIn(h, id, tipCount(id))) }

/** Brings every tip back. */
export function resetTips(): void { updateHints(resetTipsIn) }
