/** Money is whole cents. Formatting only: no prices live here. */
export type Cents = number

/** "$1,250" for whole dollars, "$1,250.50" otherwise (US dollars; the account is charged in US dollars). */
export function formatMoney(cents: Cents): string {
  const whole = cents % 100 === 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(cents / 100)
}

/** Dollars typed by a person ("1,250", "99.5", "$40") as whole cents, or null when it is not an amount. */
export function parseMoney(text: string): Cents | null {
  const clean = text.trim().replace(/^\$/, '').replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  return Math.round(Number(clean) * 100)
}
