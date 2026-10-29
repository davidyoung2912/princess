import type { Occasion } from './booking'
import type { PackageId, PersonaId, Tier } from './personas'
import { fareFor, type Cents } from './pricing'
import { CATEGORIES, type CategoryId } from './ship'

/**
 * Before-the-cruise services (Phase 13): the "find my cruise" quiz, travel advisors, marketing consent, Captain's Circle and credit
 * at booking, upgrade bids, kids' club registration, the medallion, luggage tags, and compassionate support. Names, rules and
 * amounts are authored concept values; delivery (post, email, text) is simulated.
 */
const HOUR = 3_600_000
const DAY = 24 * HOUR

const hash = (text: string): number => {
  let h = 5381
  for (const ch of text) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0
  return h
}

// ---- The "Find my cruise" quiz (DIS-06) ----
export const QUIZ_VIBES = ['relax', 'adventure', 'party', 'romance'] as const
export const QUIZ_BUDGETS = ['value', 'comfortable', 'treat'] as const
export const QUIZ_WITH = ['solo', 'couple', 'family', 'friends'] as const
export const QUIZ_MOBILITY = ['none', 'some', 'wheelchair'] as const
export const QUIZ_MUSTS = ['balcony', 'quiet', 'dining', 'drinks', 'kids'] as const

export type QuizVibe = (typeof QUIZ_VIBES)[number]
export type QuizBudget = (typeof QUIZ_BUDGETS)[number]
export type QuizWith = (typeof QUIZ_WITH)[number]
export type QuizMobility = (typeof QUIZ_MOBILITY)[number]
export type QuizMust = (typeof QUIZ_MUSTS)[number]

export interface QuizAnswers { vibe: QuizVibe; budget: QuizBudget; with: QuizWith; mobility: QuizMobility; musts: QuizMust[] }

export const DEFAULT_QUIZ: QuizAnswers = { vibe: 'relax', budget: 'comfortable', with: 'couple', mobility: 'none', musts: [] }

export interface QuizPick { category: CategoryId; score: number; reasons: string[] }
export interface QuizResult {
  /** Best match first. */
  picks: QuizPick[]
  package: PackageId
  /** Why that package. */
  packageWhy: string
  /** The notes that apply to this guest, such as accessible rooms or the tender port. */
  notes: string[]
}

const WITH_BALCONY: readonly CategoryId[] = ['balcony', 'miniSuite', 'sanctuaryMiniSuite', 'signatureSuite']
const BUDGET_FIT: Record<QuizBudget, readonly CategoryId[]> = {
  value: ['interior', 'oceanview'],
  comfortable: ['oceanview', 'balcony'],
  treat: ['miniSuite', 'sanctuaryMiniSuite', 'signatureSuite'],
}

/** A ranked shortlist of room types and a package, with the reasons for each, from five answers. Same answers, same list. */
export function recommend(a: QuizAnswers): QuizResult {
  const adultsOnlyOk = a.with !== 'family' && !a.musts.includes('kids')
  const scored = CATEGORIES.map((c): QuizPick => {
    let score = 0
    const reasons: string[] = []
    const add = (n: number, why: string) => { score += n; reasons.push(why) }
    if (BUDGET_FIT[a.budget].includes(c.id)) add(4, `budget.${a.budget}`)
    if (a.musts.includes('balcony') && WITH_BALCONY.includes(c.id)) add(4, 'balcony')
    if (a.vibe === 'romance' && WITH_BALCONY.includes(c.id)) add(2, 'romance')
    if (a.vibe === 'relax' && (c.id === 'sanctuaryMiniSuite' || c.id === 'balcony')) add(2, 'relax')
    if (a.vibe === 'adventure' && (c.id === 'interior' || c.id === 'oceanview')) add(2, 'adventure')
    if (a.vibe === 'party' && c.id !== 'sanctuaryMiniSuite') add(1, 'party')
    if (a.musts.includes('quiet') && c.id === 'sanctuaryMiniSuite' && adultsOnlyOk) add(5, 'quiet')
    if (c.id === 'sanctuaryMiniSuite' && !adultsOnlyOk) score -= 20
    if (a.with === 'family' && (c.id === 'balcony' || c.id === 'oceanview')) add(2, 'family')
    if (a.with === 'solo' && (c.id === 'interior' || c.id === 'oceanview')) add(1, 'solo')
    if (a.mobility !== 'none' && c.id === 'balcony') add(2, 'accessible')
    return { category: c.id, score, reasons }
  })
  const picks = scored.filter((p) => p.score > 0).sort((x, y) => y.score - x.score || CATEGORIES.findIndex((c) => c.id === x.category) - CATEGORIES.findIndex((c) => c.id === y.category)).slice(0, 3)
  const drinks = a.musts.includes('drinks') || a.vibe === 'party'
  const dining = a.musts.includes('dining')
  const pkg: PackageId = drinks && dining ? 'premier' : drinks || dining ? 'plus' : a.budget === 'treat' ? 'plus' : 'none'
  const notes: string[] = []
  if (a.mobility !== 'none') notes.push('accessible', 'tender')
  if (a.with === 'family' || a.musts.includes('kids')) notes.push('clubs')
  return { picks, package: pkg, packageWhy: pkg === 'premier' ? 'both' : pkg === 'plus' ? (drinks ? 'drinks' : dining ? 'dining' : 'treat') : 'none', notes }
}

/** "From" price per person for a room type on a sailing, or null. */
export const quizFare = (sailingId: string, category: CategoryId): Cents | null => fareFor(sailingId, category)

// ---- Travel advisors and consultants (DIS-15) ----
export interface Advisor { id: string; name: string; agency: string; region: string; languages: readonly string[]; speciality: 'family' | 'luxury' | 'accessible' | 'groups' | 'first'; hours: string }

export const ADVISORS: readonly Advisor[] = [
  { id: 'adv-ocean', name: 'Renata Alvarez', agency: 'Blue Door Cruises', region: 'Florida', languages: ['English', 'Spanish'], speciality: 'family', hours: 'Mon to Sat, 9:00 to 18:00 Eastern' },
  { id: 'adv-harbor', name: 'Tomasz Nowak', agency: 'Harbor & Co. Travel', region: 'New York', languages: ['English', 'Polish'], speciality: 'luxury', hours: 'Mon to Fri, 9:00 to 17:00 Eastern' },
  { id: 'adv-pacific', name: 'Keiko Tanaka', agency: 'Pacific Passage', region: 'California', languages: ['English', 'Japanese'], speciality: 'first', hours: 'Mon to Fri, 8:00 to 16:00 Pacific' },
  { id: 'adv-ease', name: 'Dana Whitfield', agency: 'Easy Access Voyages', region: 'Texas', languages: ['English'], speciality: 'accessible', hours: 'Mon to Fri, 9:00 to 17:00 Central' },
  { id: 'adv-gather', name: 'Marcus Bell', agency: 'Gather Group Travel', region: 'Illinois', languages: ['English', 'French'], speciality: 'groups', hours: 'Tue to Sat, 10:00 to 18:00 Central' },
]

export interface AdvisorFilter { speciality?: Advisor['speciality'] | ''; language?: string }

export function advisorsFor(f: AdvisorFilter): Advisor[] {
  return ADVISORS.filter((a) => (!f.speciality || a.speciality === f.speciality) && (!f.language || a.languages.includes(f.language)))
}

export const ADVISOR_LANGUAGES: readonly string[] = [...new Set(ADVISORS.flatMap((a) => a.languages))].sort()
export const ADVISOR_SPECIALITIES: readonly Advisor['speciality'][] = ['first', 'family', 'luxury', 'accessible', 'groups']

export type AdvisorWay = 'callback' | 'chat'
export type AdvisorProblem = 'badAdvisor' | 'badWay' | 'badPhone' | 'noQuestion'

export function advisorProblem(advisorId: unknown, way: unknown, phone: unknown, question: unknown): AdvisorProblem | null {
  if (!ADVISORS.some((a) => a.id === advisorId)) return 'badAdvisor'
  if (way !== 'callback' && way !== 'chat') return 'badWay'
  if (way === 'callback' && (typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10 || phone.length > 30)) return 'badPhone'
  if (typeof question !== 'string' || question.trim().length < 5 || question.length > 500) return 'noQuestion'
  return null
}

/** A chat with an advisor opens at once; a call-back is promised within a working day. The reply to a chat is scripted. */
export const ADVISOR_CALLBACK_HOURS = 24
export function advisorReply(advisorName: string, question: string): string {
  const first = advisorName.split(' ')[0]
  return `Hello, it’s ${first}. Thanks for asking${question.trim().length > 60 ? ', and for the detail' : ''}. I’ll look at the sailing dates and room types that fit and send you two or three options. Is there a date you can’t travel?`
}

// ---- Marketing consent with double opt-in (DIS-16) ----
export type ConsentRegion = 'us' | 'ca' | 'uk' | 'eu' | 'au'
export const CONSENT_REGIONS: readonly { id: ConsentRegion; doubleOptIn: boolean }[] = [
  { id: 'us', doubleOptIn: false },
  { id: 'ca', doubleOptIn: true },
  { id: 'uk', doubleOptIn: true },
  { id: 'eu', doubleOptIn: true },
  { id: 'au', doubleOptIn: false },
]
export const doubleOptInFor = (r: ConsentRegion): boolean => CONSENT_REGIONS.find((x) => x.id === r)?.doubleOptIn ?? true
export const isConsentRegion = (v: unknown): v is ConsentRegion => CONSENT_REGIONS.some((r) => r.id === v)

export type MarketingChannel = 'email' | 'sms'
export const MARKETING_CHANNELS: readonly MarketingChannel[] = ['email', 'sms']
export const isMarketingChannel = (v: unknown): v is MarketingChannel => v === 'email' || v === 'sms'

export const CONSENT_CODE_HOURS = 24

export function contactProblem(channel: MarketingChannel, value: unknown): 'badEmail' | 'badPhone' | null {
  if (typeof value !== 'string') return channel === 'email' ? 'badEmail' : 'badPhone'
  if (channel === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length <= 120 ? null : 'badEmail'
  return value.replace(/\D/g, '').length >= 10 && value.length <= 30 ? null : 'badPhone'
}

/** The six-digit code a pretend message carries; the same contact always gets the same code so the demo can show it. */
export const consentCode = (contact: string): string => String(100_000 + (hash(`consent|${contact.trim().toLowerCase()}`) % 900_000))

export type ConsentState = 'pending' | 'confirmed' | 'expired'
export interface ConsentRecord { channel: MarketingChannel; contact: string; region: ConsentRegion; askedAt: number; confirmedAt: number | null }

export function consentState(r: ConsentRecord, now: number): ConsentState {
  if (r.confirmedAt !== null) return 'confirmed'
  return now - r.askedAt > CONSENT_CODE_HOURS * HOUR ? 'expired' : 'pending'
}

// ---- Captain's Circle at booking, and credit (BOK-11, BOK-12) ----
/** Percent off the fare for each level, applied to the fare lines at booking. */
export const MEMBER_PERCENT: Record<Tier, number> = { none: 0, gold: 2, ruby: 3, platinum: 5, elite: 7 }

const digitsOf = (n: string) => n.slice(2).split('').map(Number)

/** "CC" and seven digits; the last digit is a check on the first six, so a typo is caught. */
export function loyaltyNumberOk(n: unknown): n is string {
  if (typeof n !== 'string' || !/^CC\d{7}$/.test(n)) return false
  const d = digitsOf(n)
  return d.slice(0, 6).reduce((sum, x, i) => sum + x * (i + 1), 0) % 10 === d[6]
}

/** A made-up number for a persona: valid, and the same every time. */
export function loyaltyNumberOf(id: PersonaId): string {
  const six = String(100_000 + (hash(`cc|${id}`) % 900_000))
  const check = six.split('').map(Number).reduce((sum, x, i) => sum + x * (i + 1), 0) % 10
  return `CC${six}${check}`
}

/** The level a number carries for the person signed in: their own number gives their level, any other valid number joins at Gold. */
export const tierForNumber = (n: string, id: PersonaId, ownTier: Tier): Tier => (n === loyaltyNumberOf(id) ? ownTier : 'gold')

/** Credit never takes the price below this: some of every booking is paid by card. */
export const MIN_PAID: Cents = 10_000

export interface Perks { number: string; tier: Tier; useCredit: boolean }
export interface PerkSums { discount: Cents; credit: Cents; total: Cents }

/** The member discount and future cruise credit taken off a total. Whole dollars; the credthe credit never exceeds what is left to pay. */
export function applyPerks(total: Cents, perks: Perks, creditLeft: Cents): PerkSums {
  const discount = loyaltyNumberOk(perks.number) ? Math.round((total * MEMBER_PERCENT[perks.tier]) / 10_000) * 100 : 0
  const afterDiscount = total - discount
  const credit = perks.useCredit ? Math.max(0, Math.min(creditLeft, afterDiscount - MIN_PAID)) : 0
  return { discount, credit, total: afterDiscount - credit }
}

// ---- Upgrade offers and bids (MNG-06) ----
export interface UpgradeOffer { category: CategoryId; difference: Cents; minBid: Cents; buyNow: Cents }

/** Up to two room types above the current one; the bid floor is 40% of the difference and "buy now" is 90%. Whole dollars. */
export function upgradeOffers(current: CategoryId, differenceTo: (c: CategoryId) => Cents | null): UpgradeOffer[] {
  const order = CATEGORIES.map((c) => c.id)
  const out: UpgradeOffer[] = []
  for (const category of order.slice(order.indexOf(current) + 1, order.indexOf(current) + 3)) {
    const difference = differenceTo(category)
    if (difference === null || difference <= 0) continue
    const round = (x: number) => Math.round(x / 100) * 100
    out.push({ category, difference, minBid: round(difference * 0.4), buyNow: round(difference * 0.9) })
  }
  return out
}

export type BidProblem = 'badCategory' | 'tooLow' | 'tooHigh' | 'notWhole'

export function bidProblem(offer: UpgradeOffer | undefined, cents: unknown): BidProblem | null {
  if (!offer) return 'badCategory'
  if (typeof cents !== 'number' || !Number.isInteger(cents) || cents % 100 !== 0) return 'notWhole'
  if (cents < offer.minBid) return 'tooLow'
  if (cents > offer.buyNow) return 'tooHigh'
  return null
}

/** Bids are decided this many days before departure. */
export const BID_DECIDED_DAYS = 3

/** A bid at "buy now" always wins. Otherwise the share of the range it covers decides: above the hidden line wins. The same bid always gets the same answer. */
export function bidWins(offer: UpgradeOffer, cents: Cents, key: string): boolean {
  if (cents >= offer.buyNow) return true
  const range = Math.max(1, offer.buyNow - offer.minBid)
  const line = offer.minBid + range * (0.35 + (hash(`bid|${key}`) % 40) / 100)
  return cents >= line
}

// ---- Kids' and teens' clubs (PRE-08) ----
export interface Club { id: 'firefly' | 'neon' | 'underground'; name: string; minAge: number; maxAge: number; deck: string }
export const CLUBS: readonly Club[] = [
  { id: 'firefly', name: 'Firefly Park', minAge: 3, maxAge: 7, deck: 'Deck 6' },
  { id: 'neon', name: 'Neon Grove', minAge: 8, maxAge: 12, deck: 'Deck 6' },
  { id: 'underground', name: 'The Underground', minAge: 13, maxAge: 17, deck: 'Deck 7' },
]
export const clubForAge = (age: number): Club | undefined => CLUBS.find((c) => age >= c.minAge && age <= c.maxAge)

export interface Pickup { name: string; relation: string; phone: string }
export interface ClubRegistration {
  childId: PersonaId
  allergies: string
  medical: string
  medication: string
  /** Photos of the child in the club's own memories. */
  photoConsent: boolean
  pickups: Pickup[]
  /** A teen may sign themselves out. Under 13 never may. */
  selfSignOut: boolean
  emergencyPhone: string
  confirmed: boolean
}
export const MAX_PICKUPS = 4
export const MAX_CLUB_TEXT = 300
export const blankRegistration = (childId: PersonaId): ClubRegistration => ({ childId, allergies: '', medical: '', medication: '', photoConsent: false, pickups: [], selfSignOut: false, emergencyPhone: '', confirmed: false })

export type ClubProblem = 'noClub' | 'noEmergency' | 'noPickup' | 'badPickup' | 'tooMany' | 'tooLong' | 'selfSignOut' | 'confirm'

export function clubProblem(r: ClubRegistration, age: number): ClubProblem | null {
  if (!clubForAge(age)) return 'noClub'
  if (r.emergencyPhone.replace(/\D/g, '').length < 10 || r.emergencyPhone.length > 30) return 'noEmergency'
  if (r.pickups.length > MAX_PICKUPS) return 'tooMany'
  if (r.pickups.some((p) => p.name.trim().length < 2 || p.name.length > 80 || p.relation.trim().length < 2 || p.relation.length > 40 || p.phone.replace(/\D/g, '').length < 10)) return 'badPickup'
  if (r.selfSignOut && age < 13) return 'selfSignOut'
  if (r.pickups.length === 0 && !(r.selfSignOut && age >= 13)) return 'noPickup'
  if ([r.allergies, r.medical, r.medication].some((x) => x.length > MAX_CLUB_TEXT)) return 'tooLong'
  if (!r.confirmed) return 'confirm'
  return null
}

// ---- Medallion (CHK-06) ----
export type MedallionStage = 'preparing' | 'shipped' | 'delivered' | 'collect'
export interface MedallionStatus {
  stage: MedallionStage
  events: { id: string; at: number }[]
  canActivate: boolean
  activatedAt: number | null
  lostAt: number | null
  /** After a loss, the replacement is collected at the terminal or Guest Services; the old one stops working. */
  replacement: boolean
}

export const MEDALLION_SHIP_DAYS = 14
export const MEDALLION_DELIVER_DAYS = 8

/** Made after booking, posted 14 days before sailing and delivered 8 days before. Booked later than that, it is collected at the terminal. */
export function medallionStatus(departureAt: number, bookedAt: number, now: number, activatedAt: number | null, lostAt: number | null): MedallionStatus {
  const shipAt = departureAt - MEDALLION_SHIP_DAYS * DAY
  const deliverAt = departureAt - MEDALLION_DELIVER_DAYS * DAY
  const late = bookedAt > shipAt
  const events: MedallionStatus['events'] = [{ id: 'ordered', at: bookedAt }]
  if (!late) events.push({ id: 'shipped', at: shipAt }, { id: 'delivered', at: deliverAt })
  const stage: MedallionStage = late ? 'collect' : now >= deliverAt ? 'delivered' : now >= shipAt ? 'shipped' : 'preparing'
  const live = events.filter((e) => e.at <= now)
  return { stage, events: live, canActivate: stage === 'delivered' && activatedAt === null && lostAt === null, activatedAt, lostAt, replacement: lostAt !== null }
}

// ---- Luggage tags (CHK-09) ----
export type TagWay = 'print' | 'etag' | 'order'
export const TAG_WAYS: readonly TagWay[] = ['print', 'etag', 'order']
export const isTagWay = (v: unknown): v is TagWay => TAG_WAYS.includes(v as TagWay)
export const TAGS_PER_GUEST = 2
/** A mailed set must be asked for this many days before sailing. */
export const TAG_ORDER_DAYS = 14

export type BagStage = 'none' | 'atHome' | 'handedOver' | 'onShip' | 'inCorridor' | 'delivered'
export const BAG_STAGES: readonly BagStage[] = ['atHome', 'handedOver', 'onShip', 'inCorridor', 'delivered']

/** Where a bag probably is, worked out from when it was handed over (not scanned: this is an estimate). */
export function bagStage(handedOverAt: number | null, now: number): BagStage {
  if (handedOverAt === null) return 'atHome'
  const since = now - handedOverAt
  if (since >= 5 * HOUR) return 'delivered'
  if (since >= 3 * HOUR) return 'inCorridor'
  if (since >= HOUR) return 'onShip'
  return 'handedOver'
}

export function tagProblem(way: unknown, daysToDeparture: number): 'badWay' | 'tooLate' | null {
  if (!isTagWay(way)) return 'badWay'
  if (way === 'order' && daysToDeparture < TAG_ORDER_DAYS) return 'tooLate'
  return null
}

// ---- Compassionate and assisted support (SUP-07) ----
export type AssistKind = 'assistedBooking' | 'bereavement' | 'medical'
export const ASSIST_KINDS: readonly AssistKind[] = ['assistedBooking', 'bereavement', 'medical']
export const isAssistKind = (v: unknown): v is AssistKind => ASSIST_KINDS.includes(v as AssistKind)
export type AssistStage = 'received' | 'reviewing' | 'decided'
export const ASSIST_REVIEW_HOURS = 4
export const ASSIST_DECIDE_HOURS = 48

export function assistStage(askedAt: number, now: number): AssistStage {
  const since = now - askedAt
  return since >= ASSIST_DECIDE_HOURS * HOUR ? 'decided' : since >= ASSIST_REVIEW_HOURS * HOUR ? 'reviewing' : 'received'
}

export type AssistProblem = 'badKind' | 'badPhone' | 'noNote' | 'noBooking'

export function assistProblem(kind: unknown, phone: unknown, note: unknown, hasBooking: boolean): AssistProblem | null {
  if (!isAssistKind(kind)) return 'badKind'
  if (typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10 || phone.length > 30) return 'badPhone'
  if (typeof note !== 'string' || note.trim().length < 5 || note.length > 600) return 'noNote'
  if (kind !== 'assistedBooking' && !hasBooking) return 'noBooking'
  return null
}

/** What a bereavement or medical cancellation changes: the fee is waived once the papers are seen, and the money comes back as a refund or future cruise credit. */
export function compassionTerms(paid: Cents): { fee: Cents; refund: Cents; credit: Cents } {
  return { fee: 0, refund: paid, credit: Math.round((paid * 1.1) / 100) * 100 }
}

/** A gift suggestion list for an occasion at booking (MNG-13). */
export const GIFTS_FOR: Record<Occasion, readonly string[]> = {
  none: [],
  birthday: ['gift-cake', 'gift-flowers', 'gift-decor'],
  anniversary: ['gift-champagne', 'gift-flowers', 'gift-cake'],
  honeymoon: ['gift-champagne', 'gift-flowers', 'gift-decor'],
  other: ['gift-flowers', 'gift-champagne'],
}
