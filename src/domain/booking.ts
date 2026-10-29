import { ageOn, DIETARY, NEEDS, phoneOk, type DietaryId, type NeedId } from './account'
import type { Citizenship } from './documents'
import { capacityOf, fareIncluded, fareOptions, isFareId, type FareId } from './fares'
import { LEGAL_IDS, type LegalId } from './policy'
import { sailingById } from './sailings'
import { categoryById, CATEGORIES, type CategoryId } from './ship'

/** The booking funnel (BOK-01): the answers a guest gives, saved as a draft, and the rules that say a step is complete. */
export const STEPS = ['sailing', 'room', 'fare', 'guests', 'dining', 'review', 'pay'] as const
export type StepId = (typeof STEPS)[number]

export const isStep = (v: unknown): v is StepId => (STEPS as readonly unknown[]).includes(v)

export type Gender = '' | 'F' | 'M' | 'X'
export type DietaryStatus = '' | 'none' | 'some'
export type DiningChoice = '' | 'anytime' | 'early' | 'late'
export type Occasion = 'none' | 'birthday' | 'anniversary' | 'honeymoon' | 'other'
export type CabinMode = 'guaranteed' | 'pick'

export const GENDERS: readonly Exclude<Gender, ''>[] = ['F', 'M', 'X']
export const DINING_CHOICES: readonly Exclude<DiningChoice, ''>[] = ['anytime', 'early', 'late']
export const OCCASIONS: readonly Occasion[] = ['none', 'birthday', 'anniversary', 'honeymoon', 'other']

export interface GuestDraft {
  firstName: string
  lastName: string
  /** "YYYY-MM-DD". */
  dob: string
  gender: Gender
  citizenship: Citizenship | ''
  needs: NeedId[]
  dietaryStatus: DietaryStatus
  dietary: DietaryId[]
  allergyNote: string
}

export interface LeadContact { email: string; phone: string; street: string; city: string; region: string; postcode: string; country: string }

export interface Draft {
  id: string
  sailingId: string
  category: CategoryId | ''
  guests: number
  cabinMode: CabinMode
  cabinNumber: string
  fare: FareId | ''
  people: GuestDraft[]
  contact: LeadContact
  dining: DiningChoice
  occasion: Occasion
  accepted: Partial<Record<LegalId, boolean>>
  updatedAt: number
}

export const MAX_GUESTS = 4
export const MIN_AGE_MONTHS = 6
export const ADULT_AGE_IN_ROOM = 21
export const LEAD_AGE = 18

export const blankGuest = (): GuestDraft => ({ firstName: '', lastName: '', dob: '', gender: '', citizenship: '', needs: [], dietaryStatus: '', dietary: [], allergyNote: '' })
export const blankContact = (): LeadContact => ({ email: '', phone: '', street: '', city: '', region: '', postcode: '', country: 'United States' })

export function emptyDraft(id: string, now = 0): Draft {
  return { id, sailingId: '', category: '', guests: 2, cabinMode: 'guaranteed', cabinNumber: '', fare: '', people: [blankGuest(), blankGuest()], contact: blankContact(), dining: '', occasion: 'none', accepted: {}, updatedAt: now }
}

export const guestIsBlank = (g: GuestDraft): boolean => !g.firstName && !g.lastName && !g.dob && !g.gender && !g.citizenship && g.needs.length === 0 && g.dietaryStatus === '' && g.dietary.length === 0 && !g.allergyNote

/** A new draft id; random so a resume link cannot be guessed. */
export const newDraftId = (): string => `d${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`

const str = (v: unknown, max = 120): string => (typeof v === 'string' ? v.slice(0, max) : '')
const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly unknown[]).includes(v) ? (v as T) : fallback)
const picks = <T extends string>(list: readonly T[], v: unknown): T[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is T => (list as readonly unknown[]).includes(x)))] : [])

function normalizeGuest(raw: unknown): GuestDraft {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    firstName: str(o.firstName, 60), lastName: str(o.lastName, 60), dob: str(o.dob, 10),
    gender: pick(['', ...GENDERS] as const, o.gender, ''),
    citizenship: o.citizenship === 'us' || o.citizenship === 'other' ? o.citizenship : '',
    needs: picks(NEEDS, o.needs),
    dietaryStatus: pick(['', 'none', 'some'] as const, o.dietaryStatus, ''),
    dietary: picks(DIETARY, o.dietary), allergyNote: str(o.allergyNote, 300),
  }
}

/** Sets the number of guests, keeping the people already entered and adding blanks (or dropping the end). */
export function resizePeople(draft: Draft, guests: number): Draft {
  const n = Math.min(MAX_GUESTS, Math.max(1, Math.trunc(guests) || 1))
  const people = Array.from({ length: n }, (_, i) => draft.people[i] ?? blankGuest())
  return { ...draft, guests: n, people }
}

/** A draft from untrusted stored or submitted data: anything unknown falls back to empty, and the people always match the guest count. */
export function normalizeDraft(raw: unknown, fallbackId = newDraftId()): Draft {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const c = o.contact && typeof o.contact === 'object' ? (o.contact as Record<string, unknown>) : {}
  const sailingId = sailingById(o.sailingId) ? String(o.sailingId) : ''
  const category = categoryById(o.category) ? (o.category as CategoryId) : ''
  const accepted: Partial<Record<LegalId, boolean>> = {}
  const a = o.accepted && typeof o.accepted === 'object' ? (o.accepted as Record<string, unknown>) : {}
  for (const id of LEGAL_IDS) if (a[id] === true) accepted[id] = true
  const base: Draft = {
    id: str(o.id, 40) || fallbackId, sailingId, category,
    guests: 2,
    cabinMode: o.cabinMode === 'pick' ? 'pick' : 'guaranteed', cabinNumber: str(o.cabinNumber, 8),
    fare: isFareId(o.fare) ? o.fare : '',
    people: Array.isArray(o.people) ? o.people.slice(0, MAX_GUESTS).map(normalizeGuest) : [],
    contact: { email: str(c.email), phone: str(c.phone, 30), street: str(c.street), city: str(c.city), region: str(c.region), postcode: str(c.postcode, 12), country: str(c.country) || 'United States' },
    dining: pick(['', ...DINING_CHOICES] as const, o.dining, ''),
    occasion: pick(OCCASIONS, o.occasion, 'none'),
    accepted, updatedAt: typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) ? o.updatedAt : 0,
  }
  const guests = typeof o.guests === 'number' && Number.isInteger(o.guests) ? o.guests : base.people.length || 2
  const sized = resizePeople(base, guests)
  // A room type that cannot hold the party, a fare it cannot take, or a pick with no number are cleared rather than kept.
  const cap = category ? capacityOf(category) : MAX_GUESTS
  const fixed = sized.guests > cap ? resizePeople(sized, cap) : sized
  const fare = category && fixed.fare && !fareOptions(category).includes(fixed.fare) ? '' : fixed.fare
  return { ...fixed, fare: category && !fare ? (fareIncluded(category) ?? '') : fare }
}

export type ProblemCode = 'required' | 'name' | 'date' | 'future' | 'tooYoung' | 'leadAge' | 'noAdult' | 'email' | 'phone' | 'choose' | 'detail' | 'accept' | 'capacity'
export interface Problem { path: string; code: ProblemCode }

const NAME = /^\p{L}[\p{L}\s'’.-]*$/u
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d))

/** Whole months between a birth date and a day. */
export function monthsOn(dob: string, day: string): number {
  const [by, bm, bd] = dob.split('-').map(Number)
  const [y, m, d] = day.split('-').map(Number)
  return (y - by) * 12 + (m - bm) - (d < bd ? 1 : 0)
}

export interface StepContext {
  /** Departure of the chosen sailing, "YYYY-MM-DD"; null until chosen. */
  departure: string | null
  today: string
}

/** What is missing or wrong on a step, by field. Empty when the step is complete. */
export function stepProblems(draft: Draft, step: StepId, ctx: StepContext): Problem[] {
  const out: Problem[] = []
  const need = (path: string, code: ProblemCode = 'required') => out.push({ path, code })
  switch (step) {
    case 'sailing':
      if (!sailingById(draft.sailingId)) need('sailingId', 'choose')
      break
    case 'room':
      if (!draft.category || !categoryById(draft.category)) need('category', 'choose')
      else if (draft.guests > capacityOf(draft.category)) need('guests', 'capacity')
      if (draft.cabinMode === 'pick' && !draft.cabinNumber) need('cabinNumber', 'choose')
      break
    case 'fare':
      if (!draft.category || !draft.fare || !fareOptions(draft.category).includes(draft.fare)) need('fare', 'choose')
      break
    case 'guests': {
      const departure = ctx.departure
      draft.people.forEach((g, i) => {
        const p = (f: string) => `people.${i}.${f}`
        if (!g.firstName.trim()) need(p('firstName'))
        else if (!NAME.test(g.firstName.trim())) need(p('firstName'), 'name')
        if (!g.lastName.trim()) need(p('lastName'))
        else if (!NAME.test(g.lastName.trim())) need(p('lastName'), 'name')
        if (!g.dob) need(p('dob'))
        else if (!validDate(g.dob)) need(p('dob'), 'date')
        else if (g.dob > ctx.today) need(p('dob'), 'future')
        else if (departure && monthsOn(g.dob, departure) < MIN_AGE_MONTHS) need(p('dob'), 'tooYoung')
        else if (departure && i === 0 && ageOn(g.dob, departure) < LEAD_AGE) need(p('dob'), 'leadAge')
        if (!g.gender) need(p('gender'), 'choose')
        if (!g.citizenship) need(p('citizenship'), 'choose')
      })
      const dobs = draft.people.map((g) => g.dob).filter(validDate)
      if (departure && dobs.length === draft.people.length && !dobs.some((d) => ageOn(d, departure) >= ADULT_AGE_IN_ROOM)) need('people', 'noAdult')
      const c = draft.contact
      if (!c.email.trim()) need('contact.email')
      else if (!EMAIL.test(c.email.trim())) need('contact.email', 'email')
      if (!c.phone.trim()) need('contact.phone')
      else if (!phoneOk(c.phone)) need('contact.phone', 'phone')
      for (const f of ['street', 'city', 'postcode', 'country'] as const) if (!c[f].trim()) need(`contact.${f}`)
      break
    }
    case 'dining':
      if (!draft.dining) need('dining', 'choose')
      draft.people.forEach((g, i) => {
        if (!g.dietaryStatus) need(`people.${i}.dietaryStatus`, 'choose')
        else if (g.dietaryStatus === 'some' && g.dietary.length === 0 && !g.allergyNote.trim()) need(`people.${i}.dietary`, 'detail')
      })
      break
    case 'review':
      for (const id of LEGAL_IDS) if (!draft.accepted[id]) need(`accepted.${id}`, 'accept')
      break
    case 'pay':
      break
  }
  return out
}

/** The first step that is not complete, or the payment step when everything before it is. */
export function firstIncomplete(draft: Draft, ctx: StepContext): StepId {
  return STEPS.find((s) => s !== 'pay' && stepProblems(draft, s, ctx).length > 0) ?? 'pay'
}

/** A step may be opened when every step before it is complete. */
export function canEnter(draft: Draft, step: StepId, ctx: StepContext): boolean {
  const index = STEPS.indexOf(step)
  return STEPS.slice(0, index).every((s) => stepProblems(draft, s, ctx).length === 0)
}

export type StepState = 'done' | 'current' | 'todo'

/** For the progress bar: earlier complete steps are done, the open one is current. */
export function stepStates(draft: Draft, current: StepId, ctx: StepContext): { id: StepId; state: StepState }[] {
  const at = STEPS.indexOf(current)
  return STEPS.map((id, i) => ({ id, state: id === current ? 'current' : i < at && stepProblems(draft, id, ctx).length === 0 ? 'done' : 'todo' }))
}

export const stepIndex = (step: StepId): number => STEPS.indexOf(step)
export const nextStep = (step: StepId): StepId => STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(step) + 1)]
export const prevStep = (step: StepId): StepId => STEPS[Math.max(0, STEPS.indexOf(step) - 1)]

export const CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((c) => c.id)

/** "j***@example.com", for showing where a message went without printing the whole address. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  return domain ? `${name.slice(0, 1)}***@${domain}` : '***'
}

/** "***-0142" for a phone number. */
export const maskPhone = (phone: string): string => `***-${phone.replace(/\D/g, '').slice(-4)}`

/** Fills guests that are still blank, and empty contact details, from the account (ACT-03). Entered answers are never overwritten; returns the same draft when nothing changes. */
export function fillBlank(draft: Draft, from: { people: readonly GuestDraft[]; contact: LeadContact }): Draft {
  let changed = false
  const people = draft.people.map((g, i) => {
    const source = from.people[i]
    if (!source || !guestIsBlank(g)) return g
    changed = true
    return { ...source }
  })
  const contact = { ...draft.contact }
  for (const f of ['email', 'phone'] as const) if (!contact[f] && from.contact[f]) { contact[f] = from.contact[f]; changed = true }
  return changed ? { ...draft, people, contact } : draft
}
