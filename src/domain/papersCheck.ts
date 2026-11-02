import { ADULT_AGE, docStatus, type Citizenship, type Held } from './documents'

/**
 * Document sanity checks (S3-02). Rules only: nothing is scanned, uploaded or stored, and the passport name is typed in and compared on the device.
 * Authored concept rules for a closed-loop Caribbean cruise; check official sources before you travel. Pure.
 */
export type NameMatch = 'empty' | 'match' | 'order' | 'middle' | 'typo' | 'different'

const tokens = (name: string): string[] =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean)

/** The number of single-letter changes between two words. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = keep
    }
  }
  return row[b.length]
}

/** How the name on the booking compares with the name on the passport: case, accents, hyphens and spacing are ignored. */
export function compareNames(booked: string, passport: string): NameMatch {
  const a = tokens(booked)
  const b = tokens(passport)
  if (b.length === 0 || a.length === 0) return 'empty'
  if (a.join(' ') === b.join(' ')) return 'match'
  if ([...a].sort().join(' ') === [...b].sort().join(' ')) return 'order'
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (short.length >= 2 && short.every((x) => long.includes(x))) return 'middle'
  if (a.length === b.length) {
    const sorted = [[...a].sort(), [...b].sort()]
    const total = sorted[0].reduce((n, x, i) => n + distance(x, sorted[1][i]), 0)
    const worst = sorted[0].reduce((n, x, i) => Math.max(n, distance(x, sorted[1][i])), 0)
    if (total <= 2 && worst <= 2) return 'typo'
  }
  return 'different'
}

export type WithParents = 'both' | 'one' | 'neither'
export const WITH_PARENTS: readonly WithParents[] = ['both', 'one', 'neither']
export const isWithParents = (v: unknown): v is WithParents => WITH_PARENTS.includes(v as WithParents)
export const ADULT_AT = 18

export type CheckLevel = 'ok' | 'note' | 'fix'
export interface PaperCheck {
  /** Text key suffix: the screen shows `papers.<id>`. */
  id: string
  level: CheckLevel
  /** An app screen that helps put it right. */
  link?: string
  params?: Record<string, string | number>
}

export interface PapersInput {
  bookedName: string
  /** The name as printed on the passport, typed by the guest; empty if not entered. */
  passportName: string
  age: number
  citizenship: Citizenship
  held: Held
  returnDate: string
  /** Who is travelling with a child; ignored for an adult. */
  withParents: WithParents
}

export function papersCheck(i: PapersInput): PaperCheck[] {
  const out: PaperCheck[] = []
  const hasPassport = !!i.held.passport
  const hasBirth = !!i.held.birthCertificate
  const hasPhoto = !!i.held.photoId

  const match = compareNames(i.bookedName, i.passportName)
  if (match !== 'empty') {
    out.push({ id: `name.${match}`, level: match === 'match' ? 'ok' : match === 'different' || match === 'typo' ? 'fix' : 'note', link: match === 'match' ? undefined : '/me/fix-it' })
  } else if (hasPassport) out.push({ id: 'name.enter', level: 'note' })

  if (hasPassport) {
    const s = docStatus('passport', i.held, i.returnDate)
    if (s === 'expired' || s === 'tooSoon') out.push({ id: `passport.${s}`, level: 'fix', link: '/me/documents' })
    else if (s === 'noExpiry') out.push({ id: 'passport.noExpiry', level: 'note', link: '/me/documents' })
    else out.push({ id: 'passport.ok', level: 'ok' })
  } else if (i.citizenship === 'other') out.push({ id: 'passport.missing', level: 'fix', link: '/me/documents' })

  if (i.citizenship === 'us' && !hasPassport) {
    const adult = i.age >= ADULT_AGE
    if (adult && hasBirth && !hasPhoto) out.push({ id: 'combo.needPhoto', level: 'fix', link: '/me/documents' })
    else if (adult && hasPhoto && !hasBirth) out.push({ id: 'combo.needProof', level: 'fix', link: '/me/documents' })
    else if (adult && !hasBirth && !hasPhoto) out.push({ id: 'combo.none', level: 'fix', link: '/me/documents' })
    else if (!adult && !hasBirth) out.push({ id: 'combo.childNeedsProof', level: 'fix', link: '/me/documents' })
    else out.push({ id: adult ? 'combo.ok' : 'combo.childOk', level: 'ok' })
    if (hasBirth) out.push({ id: 'combo.certified', level: 'note' })
  }

  if (i.age < ADULT_AT && i.withParents !== 'both') out.push({ id: `consent.${i.withParents}`, level: 'fix' })
  return out
}

/** The checks that need putting right, most pressing first. */
export const fixes = (checks: readonly PaperCheck[]): PaperCheck[] => checks.filter((c) => c.level === 'fix')
