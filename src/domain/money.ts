/** Money is whole cents. Formatting only: no prices live here. */
export type Cents = number

/** "$1,250" for whole dollars, "$1,250.50" otherwise (US dollars; the account is charged in US dollars). */
export function formatMoney(cents: Cents): string {
  const whole = cents % 100 === 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(cents / 100)
}
