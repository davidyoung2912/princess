import { phoneOk, type EmergencyContact } from './account'
import { docStatus, type Citizenship } from './documents'
import { LEGAL } from './policy'

/**
 * Online check-in (CHK-01, CHK-02, CHK-03, CHK-13). Eight steps: six are answered for each guest, two once for the
 * whole booking. A parent or guardian completes every step for a child. Rules and texts are authored concept values.
 */
export type GuestStepId = 'confirm' | 'document' | 'photo' | 'emergency' | 'contract' | 'health'
export type BookingStepId = 'payment' | 'arrival'
export type StepId = GuestStepId | BookingStepId

/** The order the steps are shown in; the guest-level and booking-level steps are mixed the way the guest meets them. */
export const STEP_ORDER: readonly StepId[] = ['confirm', 'document', 'photo', 'emergency', 'payment', 'contract', 'health', 'arrival']
export const GUEST_STEPS: readonly GuestStepId[] = ['confirm', 'document', 'photo', 'emergency', 'contract', 'health']
export const BOOKING_STEPS: readonly BookingStepId[] = ['payment', 'arrival']

export const isStepId = (v: unknown): v is StepId => (STEP_ORDER as readonly unknown[]).includes(v)
export const isGuestStep = (s: StepId): s is GuestStepId => (GUEST_STEPS as readonly StepId[]).includes(s)

/** Check-in opens three days before sailing and closes at 10:00 on sailing day; after that, the terminal desk takes over (CHK-08). */
export const OPEN_DAYS_BEFORE = 3
export const CLOSE_TIME = '10:00'

export type DocumentKind = 'passport' | 'birthCertificate'

export interface GuestCheckin {
  confirm?: { at: number }
  /** Only the last four characters of a passport number are kept. */
  document?: { kind: DocumentKind; country: string; last4: string; expires: string; at: number }
  /** What the device measured; the photo itself is never kept. */
  photo?: { at: number }
  emergency?: EmergencyContact & { at: number }
  contract?: { version: string; at: number; by: string }
  health?: { answers: Record<string, boolean>; flagged: boolean; at: number }
}

export interface BookingCheckin {
  payment?: { cardId: string; label: string; at: number }
}

// ---- Travel document (CHK-01, CHK-03) ----

export type DocumentProblem = 'kind' | 'country' | 'number' | 'expiry' | 'expired' | 'tooSoon' | 'notAllowed'

export interface DocumentInput { kind: unknown; country: unknown; number: unknown; expires: unknown }

export const normalizePassportNumber = (v: string): string => v.replace(/[\s-]/g, '').toUpperCase()

/**
 * Problems with the document details. A passport needs a number and an expiry six months past the return date; a US
 * guest on a closed-loop cruise may instead bring a certified birth certificate (with photo ID for 16 and over).
 */
export function validateDocument(input: DocumentInput, citizenship: Citizenship, returnDate: string): DocumentProblem | null {
  if (input.kind !== 'passport' && input.kind !== 'birthCertificate') return 'kind'
  if (input.kind === 'birthCertificate') return citizenship === 'us' ? null : 'notAllowed'
  if (typeof input.country !== 'string' || input.country.trim().length < 2) return 'country'
  if (typeof input.number !== 'string' || !/^[A-Z0-9]{6,9}$/.test(normalizePassportNumber(input.number))) return 'number'
  if (typeof input.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.expires) || Number.isNaN(Date.parse(input.expires))) return 'expiry'
  const status = docStatus('passport', { passport: { expires: input.expires } }, returnDate)
  return status === 'expired' ? 'expired' : status === 'tooSoon' ? 'tooSoon' : null
}

// ---- Security photo (CHK-01, CHK-03) ----

/** What the phone measured from the picture: size, average brightness (0 to 255) and sharpness (edge strength). */
export interface PhotoMetrics { width: number; height: number; brightness: number; sharpness: number }

export type PhotoProblem = 'small' | 'shape' | 'dark' | 'bright' | 'blurry'

export const PHOTO_LIMITS = { minSide: 400, minRatio: 0.6, maxRatio: 1.4, minBrightness: 70, maxBrightness: 200, minSharpness: 12 } as const

/** Measures a picture's pixels (RGBA, row by row). Brightness is the mean luma; sharpness is the mean size of the change between neighbouring pixels. */
export function measurePhoto(width: number, height: number, rgba: ArrayLike<number>, sourceWidth = width, sourceHeight = height): PhotoMetrics {
  const luma = new Float64Array(width * height)
  let total = 0
  for (let i = 0; i < luma.length; i++) {
    const v = 0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]
    luma[i] = v
    total += v
  }
  let edge = 0
  let count = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = luma[y * width + x]
      if (x + 1 < width) { edge += Math.abs(v - luma[y * width + x + 1]); count++ }
      if (y + 1 < height) { edge += Math.abs(v - luma[(y + 1) * width + x]); count++ }
    }
  }
  return { width: sourceWidth, height: sourceHeight, brightness: luma.length ? total / luma.length : 0, sharpness: count ? edge / count : 0 }
}

/** Everything wrong with a photo, so the guest can fix it in one go. Empty when it is good. */
export function judgePhoto(m: PhotoMetrics): PhotoProblem[] {
  const L = PHOTO_LIMITS
  const problems: PhotoProblem[] = []
  const finite = [m.width, m.height, m.brightness, m.sharpness].every((n) => typeof n === 'number' && Number.isFinite(n))
  if (!finite) return ['small']
  if (Math.min(m.width, m.height) < L.minSide) problems.push('small')
  const ratio = m.width / Math.max(1, m.height)
  if (ratio < L.minRatio || ratio > L.maxRatio) problems.push('shape')
  if (m.brightness < L.minBrightness) problems.push('dark')
  if (m.brightness > L.maxBrightness) problems.push('bright')
  if (m.sharpness < L.minSharpness) problems.push('blurry')
  return problems
}

/** Sample measurements for the demo buttons, since a laptop may have no camera. */
export const SAMPLE_PHOTOS: Record<'good' | 'dark' | 'blurry', PhotoMetrics> = {
  good: { width: 1200, height: 1500, brightness: 135, sharpness: 28 },
  dark: { width: 1200, height: 1500, brightness: 38, sharpness: 24 },
  blurry: { width: 1200, height: 1500, brightness: 130, sharpness: 5 },
}

// ---- Emergency contact (CHK-01) ----

export type EmergencyProblem = 'name' | 'phone' | 'relationship' | 'travelling'

/** The contact must be someone who is not on the ship: not one of the guests on this booking. */
export function validateEmergency(c: EmergencyContact, guestNames: readonly string[]): EmergencyProblem | null {
  const name = c.name.trim().toLowerCase()
  if (name.length < 2) return 'name'
  if (!phoneOk(c.phone)) return 'phone'
  if (!c.relationship.trim()) return 'relationship'
  return guestNames.some((g) => g.trim().toLowerCase() === name) ? 'travelling' : null
}

// ---- Health questions ----

export const HEALTH_QUESTIONS = ['symptoms', 'positive', 'contact'] as const
export type HealthQuestionId = (typeof HEALTH_QUESTIONS)[number]

/** Every question needs an answer. Any "yes" is passed on to the terminal nurse; it never blocks check-in. */
export function validateHealth(raw: unknown): { answers: Record<string, boolean>; flagged: boolean } | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const answers: Record<string, boolean> = {}
  for (const q of HEALTH_QUESTIONS) {
    if (typeof o[q] !== 'boolean') return null
    answers[q] = o[q]
  }
  return { answers, flagged: Object.values(answers).some(Boolean) }
}

// ---- Contract ----

const TERMS = LEGAL.find((l) => l.id === 'terms')!
/** The check-in agreement is the booking terms, in the version in force. */
export const CONTRACT = { id: TERMS.id, version: TERMS.version, title: TERMS.title, statement: TERMS.statement, body: TERMS.body }

// ---- Progress (CHK-02) ----

export interface GuestProgress {
  done: GuestStepId[]
  left: GuestStepId[]
  complete: boolean
}

export function guestProgress(rec: GuestCheckin | undefined): GuestProgress {
  const done = GUEST_STEPS.filter((s) => !!rec?.[s])
  const left = GUEST_STEPS.filter((s) => !rec?.[s])
  return { done, left, complete: left.length === 0 }
}

export interface CheckinProgress {
  /** Steps finished, counting each guest's six and the two for the booking. */
  done: number
  total: number
  complete: boolean
  bookingLeft: BookingStepId[]
  /** The first thing still to do, in step order; null when everything is done. */
  next: { step: StepId; guest: string | null } | null
}

export function checkinProgress(guests: readonly { id: string; progress: GuestProgress }[], booking: Readonly<Record<BookingStepId, boolean>>): CheckinProgress {
  const bookingLeft = BOOKING_STEPS.filter((s) => !booking[s])
  const done = guests.reduce((n, g) => n + g.progress.done.length, 0) + (BOOKING_STEPS.length - bookingLeft.length)
  const total = guests.length * GUEST_STEPS.length + BOOKING_STEPS.length
  let next: CheckinProgress['next'] = null
  for (const step of STEP_ORDER) {
    if (isGuestStep(step)) {
      const g = guests.find((x) => x.progress.left.includes(step))
      if (g) { next = { step, guest: g.id }; break }
    } else if (bookingLeft.includes(step)) { next = { step, guest: null }; break }
  }
  return { done, total, complete: next === null, bookingLeft, next }
}

/** Whether one step is finished for the whole booking. */
export const stepDone = (step: StepId, guests: readonly { progress: GuestProgress }[], bookingLeft: readonly BookingStepId[]): boolean =>
  isGuestStep(step) ? guests.every((g) => g.progress.done.includes(step)) : !bookingLeft.includes(step as BookingStepId)

export type CheckinWindow = 'notOpen' | 'open' | 'closed'

/** Whether online check-in can be used at a moment; `closesAt` is 10:00 on sailing day. */
export const checkinWindow = (now: number, opensAt: number, closesAt: number): CheckinWindow => (now < opensAt ? 'notOpen' : now >= closesAt ? 'closed' : 'open')

/** Reads a guest record from untrusted stored data. */
export function normalizeGuestCheckin(raw: unknown): GuestCheckin {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const at = (v: unknown): number | null => (v && typeof v === 'object' && typeof (v as { at?: unknown }).at === 'number' ? (v as { at: number }).at : null)
  const out: GuestCheckin = {}
  if (at(o.confirm) !== null) out.confirm = { at: at(o.confirm)! }
  const d = o.document as Record<string, unknown> | undefined
  if (at(d) !== null && (d!.kind === 'passport' || d!.kind === 'birthCertificate')) out.document = { kind: d!.kind, country: String(d!.country ?? ''), last4: String(d!.last4 ?? ''), expires: String(d!.expires ?? ''), at: at(d)! }
  if (at(o.photo) !== null) out.photo = { at: at(o.photo)! }
  const e = o.emergency as Record<string, unknown> | undefined
  if (at(e) !== null) out.emergency = { name: String(e!.name ?? ''), phone: String(e!.phone ?? ''), relationship: String(e!.relationship ?? ''), at: at(e)! }
  const c = o.contract as Record<string, unknown> | undefined
  if (at(c) !== null) out.contract = { version: String(c!.version ?? ''), by: String(c!.by ?? ''), at: at(c)! }
  const h = o.health as Record<string, unknown> | undefined
  if (at(h) !== null) {
    const v = validateHealth(h!.answers)
    if (v) out.health = { ...v, at: at(h)! }
  }
  return out
}
