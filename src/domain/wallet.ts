import type { Cents } from './money'

/**
 * The credit wallet (REM-10): what each future cruise credit was worth, what is left, when it runs out, and whether the
 * redemption history adds up to what has been spent. The server sends the rows; this only totals them so the screen can say
 * when the figures do not reconcile.
 */
export interface WalletCredit { original: Cents; remaining: Cents; expired: boolean }

export interface WalletTotals {
  /** Left on credits that have not run out. */
  usable: Cents
  /** Left on credits that have run out (lost). */
  lapsed: Cents
  /** Original minus remaining, over every credit. */
  spent: Cents
  /** The sum of the redemption history. */
  redeemed: Cents
  /** Every cent spent shows in the history. */
  reconciles: boolean
}

export function walletTotals(credits: readonly WalletCredit[], uses: readonly { amount: Cents }[]): WalletTotals {
  const usable = credits.filter((c) => !c.expired).reduce((a, c) => a + c.remaining, 0)
  const lapsed = credits.filter((c) => c.expired).reduce((a, c) => a + c.remaining, 0)
  const spent = credits.reduce((a, c) => a + (c.original - c.remaining), 0)
  const redeemed = uses.reduce((a, u) => a + u.amount, 0)
  return { usable, lapsed, spent, redeemed, reconciles: spent === redeemed }
}

/** Whole days from `today` to a YYYY-MM-DD expiry; negative once past. */
export function daysToExpiry(expiresOn: string, today: string): number {
  return Math.round((Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}
