import type { Citizenship } from './documents'
import { limit } from './limits'

/** Account data (ACT-03, MNG-04): profile, preferences, cards and the helper role. Defaults come from the demo person; saved edits replace them. */
export type DietaryId = 'vegetarian' | 'vegan' | 'glutenFree' | 'nutAllergy' | 'shellfishAllergy' | 'dairyFree' | 'halal' | 'kosher'
export type NeedId = 'mobility' | 'hearing' | 'vision' | 'cpap' | 'oxygen' | 'serviceAnimal'
export type Bedding = 'queen' | 'twin' | 'noPreference'

export const DIETARY: readonly DietaryId[] = ['vegetarian', 'vegan', 'glutenFree', 'nutAllergy', 'shellfishAllergy', 'dairyFree', 'halal', 'kosher']
export const NEEDS: readonly NeedId[] = ['mobility', 'hearing', 'vision', 'cpap', 'oxygen', 'serviceAnimal']
export const BEDDING: readonly Bedding[] = ['queen', 'twin', 'noPreference']

export interface EmergencyContact { name: string; phone: string; relationship: string }

export interface Profile {
  firstName: string
  lastName: string
  /** "YYYY-MM-DD". */
  dob: string
  email: string
  phone: string
  citizenship: Citizenship
  dietary: DietaryId[]
  needs: NeedId[]
  bedding: Bedding
  specialRequests: string
  emergency: EmergencyContact
}

const str = (v: unknown, fallback: string, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : fallback)
const pick = <T extends string>(list: readonly T[], v: unknown): T[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is T => (list as readonly unknown[]).includes(x)))] : [])

export type ProfileField = 'firstName' | 'lastName' | 'dob' | 'email' | 'phone' | 'emergencyName' | 'emergencyPhone'
export type FieldProblem = 'required' | 'email' | 'phone' | 'date' | 'future' | 'pair'
export type ProfileErrors = Partial<Record<ProfileField, FieldProblem>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const phoneOk = (v: string) => /^[\d\s()+.-]+$/.test(v) && v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15

/** Problems with a profile, by field. `today` is "YYYY-MM-DD". Contact details are optional for children. */
export function validateProfile(p: Profile, today: string, child: boolean): ProfileErrors {
  const errors: ProfileErrors = {}
  if (!p.firstName.trim()) errors.firstName = 'required'
  if (!p.lastName.trim()) errors.lastName = 'required'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dob) || Number.isNaN(Date.parse(p.dob))) errors.dob = p.dob ? 'date' : 'required'
  else if (p.dob > today) errors.dob = 'future'
  if (p.email ? !EMAIL.test(p.email) : !child) errors.email = p.email ? 'email' : 'required'
  if (p.phone ? !phoneOk(p.phone) : false) errors.phone = 'phone'
  const hasName = !!p.emergency.name.trim()
  const hasPhone = !!p.emergency.phone.trim()
  if (hasName !== hasPhone) errors[hasName ? 'emergencyPhone' : 'emergencyName'] = 'pair'
  else if (hasPhone && !phoneOk(p.emergency.phone)) errors.emergencyPhone = 'phone'
  return errors
}

/** Whole years between a birth date and a day. */
export function ageOn(dob: string, day: string): number {
  const [by, bm, bd] = dob.split('-').map(Number)
  const [y, m, d] = day.split('-').map(Number)
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0)
}

const distance = (a: string, b: string): number => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
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

export let NAME_TYPO_LIMIT = 3
export let NAME_LOCK_DAYS = 14

export type NameChange = { allowed: true } | { allowed: false; reason: 'late' | 'large' }

/** Name rules (MNG-04): a spelling fix online up to two weeks before sailing; a different person's name, or any change later, goes through Guest Services. */
export function nameChange(before: string, after: string, daysToDeparture: number): NameChange {
  const a = before.trim().toLowerCase()
  const b = after.trim().toLowerCase()
  if (a === b) return { allowed: true }
  if (daysToDeparture < NAME_LOCK_DAYS) return { allowed: false, reason: 'late' }
  return distance(a, b) <= NAME_TYPO_LIMIT ? { allowed: true } : { allowed: false, reason: 'large' }
}

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover'
export const CARD_BRANDS: readonly CardBrand[] = ['visa', 'mastercard', 'amex', 'discover']

/** A saved card. Only the last four digits are ever kept. */
export interface Card { id: string; brand: CardBrand; last4: string; /** "MM/YY". */ expiry: string }

export const BRAND_NAMES: Record<CardBrand, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover' }

export type CardProblem = 'last4' | 'expiry' | 'expired'

/** Problems with a new card; `today` is "YYYY-MM-DD". A card is good through the end of its expiry month. */
export function validateCard(last4: string, expiry: string, today: string): CardProblem | null {
  if (!/^\d{4}$/.test(last4)) return 'last4'
  const m = /^(\d{2})\/(\d{2})$/.exec(expiry)
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return 'expiry'
  return `20${m[2]}-${m[1]}` < today.slice(0, 7) ? 'expired' : null
}

export type PermissionId = 'view' | 'documents' | 'payments' | 'profile'
export const PERMISSIONS: readonly PermissionId[] = ['view', 'documents', 'payments', 'profile']
/** Permissions the server does not act on yet: a helper cannot reach a guest's booking to pay (see `docs/best-in-market-plan.md`, BM6). They are shown as unavailable and are not saved. */
export const NOT_YET: readonly PermissionId[] = ['payments']
export const permissionWorks = (p: PermissionId): boolean => !NOT_YET.includes(p)

export type HelperStatus = 'requested' | 'active' | 'revoked'

/** A family member or friend who can manage the booking for a guest, only with that guest's consent (INC-01). */
export interface Helper { name: string; relationship: string; permissions: PermissionId[]; status: HelperStatus; /** When the guest last changed it. */ at: number }

export function normalizeHelper(raw: unknown): Helper | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!o || typeof o.name !== 'string' || !o.name.trim()) return null
  const status: HelperStatus = o.status === 'active' || o.status === 'revoked' ? o.status : 'requested'
  return { name: o.name.slice(0, 80), relationship: str(o.relationship, '', 40), permissions: pick(PERMISSIONS, o.permissions), status, at: typeof o.at === 'number' ? o.at : 0 }
}

/** Whether a helper may do something: only while active, and view is needed for everything. */
export const helperMay = (h: Helper | null, permission: PermissionId): boolean => !!h && h.status === 'active' && h.permissions.includes('view') && h.permissions.includes(permission)

export interface HistoryEntry { id: string; at: number; /** Who made the change. */ by: string; what: 'profile' | 'documents' | 'payment' | 'card' | 'helper' | 'trip' | 'notifications' | 'booking' | 'tour' | 'dining' | 'purchase' | 'assistance' | 'travel' | 'checkin'; detail: string }

// Served limits (`GET /reference/limits`) replace these defaults in place.
limit('NAME_TYPO_LIMIT', (v) => { NAME_TYPO_LIMIT = v }, NAME_TYPO_LIMIT)
limit('NAME_LOCK_DAYS', (v) => { NAME_LOCK_DAYS = v }, NAME_LOCK_DAYS)
