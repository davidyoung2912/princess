/**
 * Phone numbers for entry forms: a country (its dial code and how long a number there is), live formatting as the digits are typed, and the
 * whole number as `+<code><digits>` (E.164, the form the server keeps). Not a full numbering plan: it covers the places most guests call from and
 * checks each number's length, which catches a missing or extra digit without refusing a real number.
 */
export interface PhoneCountry {
  /** Lower-case ISO 3166 code (the first one listed for a shared dial code is the one chosen when a pasted number carries only the code). */
  iso: string
  name: string
  /** The dial code without the plus. */
  code: string
  /** Fewest and most digits after the dial code (a trunk 0 is not counted). */
  min: number
  max: number
  /** How the digits are grouped: `#` is a digit, anything else is copied; digits past the pattern are added on the end. */
  pattern: string
}

const c = (iso: string, name: string, code: string, min: number, max: number, pattern: string): PhoneCountry => ({ iso, name, code, min, max, pattern })

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  c('us', 'United States, Canada and Caribbean', '1', 10, 10, '(###) ###-####'),
  c('gb', 'United Kingdom', '44', 9, 10, '#### ######'),
  c('au', 'Australia', '61', 9, 9, '### ### ###'),
  c('nz', 'New Zealand', '64', 8, 10, '## ### ####'),
  c('ie', 'Ireland', '353', 7, 9, '## ### ####'),
  c('de', 'Germany', '49', 6, 12, '#### ########'),
  c('fr', 'France', '33', 9, 9, '# ## ## ## ##'),
  c('es', 'Spain', '34', 9, 9, '### ## ## ##'),
  c('it', 'Italy', '39', 9, 10, '### ### ####'),
  c('pt', 'Portugal', '351', 9, 9, '### ### ###'),
  c('nl', 'Netherlands', '31', 9, 9, '# ########'),
  c('be', 'Belgium', '32', 8, 9, '### ## ## ##'),
  c('ch', 'Switzerland', '41', 9, 9, '## ### ## ##'),
  c('at', 'Austria', '43', 7, 13, '### ######'),
  c('se', 'Sweden', '46', 7, 10, '## ### ## ##'),
  c('no', 'Norway', '47', 8, 8, '### ## ###'),
  c('dk', 'Denmark', '45', 8, 8, '## ## ## ##'),
  c('fi', 'Finland', '358', 6, 11, '## ### ####'),
  c('pl', 'Poland', '48', 9, 9, '### ### ###'),
  c('gr', 'Greece', '30', 10, 10, '### ### ####'),
  c('tr', 'Turkey', '90', 10, 10, '### ### ## ##'),
  c('mx', 'Mexico', '52', 10, 10, '## #### ####'),
  c('br', 'Brazil', '55', 10, 11, '## #####-####'),
  c('ar', 'Argentina', '54', 10, 11, '## ####-####'),
  c('cl', 'Chile', '56', 9, 9, '# #### ####'),
  c('co', 'Colombia', '57', 10, 10, '### ### ####'),
  c('pe', 'Peru', '51', 9, 9, '### ### ###'),
  c('jp', 'Japan', '81', 9, 10, '## #### ####'),
  c('kr', 'South Korea', '82', 9, 10, '## #### ####'),
  c('cn', 'China', '86', 11, 11, '### #### ####'),
  c('hk', 'Hong Kong', '852', 8, 8, '#### ####'),
  c('tw', 'Taiwan', '886', 9, 9, '### ### ###'),
  c('sg', 'Singapore', '65', 8, 8, '#### ####'),
  c('my', 'Malaysia', '60', 8, 10, '## ### ####'),
  c('th', 'Thailand', '66', 8, 9, '## ### ####'),
  c('ph', 'Philippines', '63', 10, 10, '### ### ####'),
  c('id', 'Indonesia', '62', 8, 12, '### #### ####'),
  c('vn', 'Vietnam', '84', 9, 10, '## ### ## ##'),
  c('in', 'India', '91', 10, 10, '##### #####'),
  c('ae', 'United Arab Emirates', '971', 8, 9, '## ### ####'),
  c('sa', 'Saudi Arabia', '966', 9, 9, '## ### ####'),
  c('il', 'Israel', '972', 8, 9, '## ### ####'),
  c('eg', 'Egypt', '20', 9, 10, '## #### ####'),
  c('za', 'South Africa', '27', 9, 9, '## ### ####'),
]

const BY_ISO = new Map(PHONE_COUNTRIES.map((p) => [p.iso, p]))
export const phoneCountry = (iso: string): PhoneCountry => BY_ISO.get(iso) ?? PHONE_COUNTRIES[0]!

/** The country to start on, from a language tag such as `en-GB` (the United States, and anywhere not listed, start on +1). */
export function defaultPhoneCountry(locale: string | undefined): string {
  const region = /[-_]([A-Za-z]{2})\b/.exec(locale ?? '')?.[1]?.toLowerCase()
  if (region === 'ca') return 'us'
  return region && BY_ISO.has(region) ? region : 'us'
}

/** Only the digits, no more than a number in this country can have. */
export function cleanNational(country: PhoneCountry, typed: string): string {
  return typed.replace(/\D/g, '').slice(0, Math.min(country.max, 15 - country.code.length))
}

/** The digits laid out for reading, as far as they go: `5551234` becomes `(555) 123-4`. */
export function formatNational(country: PhoneCountry, digits: string): string {
  if (!digits) return ''
  let out = ''
  let i = 0
  for (const ch of country.pattern) {
    if (i >= digits.length) break
    if (ch === '#') out += digits[i++]
    else out += ch
  }
  return i < digits.length ? `${out} ${digits.slice(i)}` : out
}

/** Whether the digits make a whole number in this country. */
export const isNationalComplete = (country: PhoneCountry, digits: string): boolean => digits.length >= country.min && digits.length <= country.max

/** The whole number as `+<code><digits>`, or an empty string when no digits are typed. */
export const toE164 = (country: PhoneCountry, digits: string): string => (digits ? `+${country.code}${digits}` : '')

/**
 * Reads a number pasted or typed in full (`+44 7700 900123`, `001 555 123 4567`): the country its dial code belongs to (the longest code that
 * matches) and the digits after it. Null when it does not start with a plus or 00, or the code is not one listed.
 */
export function splitInternational(text: string): { country: PhoneCountry; digits: string } | null {
  const t = text.trim()
  const all = t.replace(/\D/g, '')
  const digits = t.startsWith('+') ? all : t.startsWith('00') ? all.slice(2) : null
  if (digits === null) return null
  const matches = PHONE_COUNTRIES.filter((p) => digits.startsWith(p.code)).sort((a, b) => b.code.length - a.code.length)
  const hit = matches[0]
  return hit ? { country: hit, digits: cleanNational(hit, digits.slice(hit.code.length)) } : null
}

/** Whether a stored `+<code><digits>` number is a whole one: a listed country with a right-length number, or any other country's 7 to 15 digits. */
export function isWholePhone(e164: string): boolean {
  const t = e164.trim()
  if (!/^\+\d+$/.test(t) || t.length < 8 || t.length > 16) return false
  const all = t.slice(1)
  const country = PHONE_COUNTRIES.filter((p) => all.startsWith(p.code)).sort((x, y) => y.code.length - x.code.length)[0]
  return country ? isNationalComplete(country, all.slice(country.code.length)) : true
}
