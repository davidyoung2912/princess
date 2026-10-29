import type { Problem } from '../../domain/booking'
import { t, type StringKey } from '../../i18n'

/** Last part of a field path, e.g. "people.1.firstName" is "firstName". */
const fieldOf = (path: string): string => path.split('.').pop() ?? path

/** "Guest 2: First name" for a guest field, else just the field name. */
export function fieldLabel(path: string): string {
  const guest = /^people\.(\d+)\./.exec(path)
  const name = t(`book.field.${fieldOf(path)}` as StringKey)
  return guest ? t('book.guestField', { n: Number(guest[1]) + 1, field: name }) : name
}

/** What is wrong with a field, in words that say what to do. */
export function problemText(p: Problem): string {
  return t(`book.err.${p.code}` as StringKey, { field: fieldLabel(p.path) })
}
