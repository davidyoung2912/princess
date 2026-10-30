// Builds db/seed/personas/*.sql: demo users, bookings and journey data in partial-completion states.
// `npm run db:persona:gen` writes the files; `npm run db:persona:check` proves them.
// Money, dates and stage times come from the same domain code the UI uses, so the data cannot drift from the rules.
import { createHash, pbkdf2Sync } from 'node:crypto'
import { nstr } from './reference-seed.ts'
import { SAILINGS, itinerary, stageStarts, type StageId } from '../src/domain/sailings.ts'
import { bookingQuote, type FareId } from '../src/domain/fares.ts'
import { paymentPlan, daysBetween } from '../src/domain/trip.ts'
import { cabinsFor } from '../src/domain/cabins.ts'
import { EXCURSIONS, guestPrice, dayOf } from '../src/domain/excursions.ts'
import { ADD_ONS } from '../src/domain/packages.ts'
import { DEFAULT_PREFS } from '../src/domain/notifications.ts'
import type { CategoryId } from '../src/domain/ship.ts'

export const DEMO_PASSWORD = 'Sailaway!2027'
export const EMAIL_DOMAIN = 'demo.princess.example'
export const PBKDF2_ITERATIONS = 600_000

const REF = SAILINGS.find((s) => s.reference)!
const DEPARTURE = REF.departure
const DAYS = itinerary(REF)
const stageAtMs = (id: StageId, hours = 0): number => stageStarts(REF).find((s) => s.id === id)!.at + hours * 3_600_000

// ---------------------------------------------------------------- SQL helpers
class Raw {
  sql: string
  constructor(sql: string) { this.sql = sql }
}
const raw = (sql: string) => new Raw(sql)
type V = string | number | boolean | null | Raw
const v = (x: V): string => (x === null ? 'NULL' : x instanceof Raw ? x.sql : typeof x === 'string' ? nstr(x) : typeof x === 'boolean' ? (x ? '1' : '0') : String(x))
const U = (slug: string) => raw(`@u_${slug}`)
const B = (key: string) => raw(`@b_${key}`)
const ts = (ms: number) => raw(`CAST('${new Date(ms).toISOString().slice(0, 19)}' AS DATETIME2(0))`)
const dt = (iso: string | null) => (iso === null ? raw('CAST(NULL AS DATE)') : raw(`CAST('${iso}' AS DATE)`))
const tm = (hhmm: string) => raw(`CAST('${hhmm}:00' AS TIME(0))`)
const json = (x: unknown) => raw(nstr(JSON.stringify(x)))
const addIso = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const guid = (key: string) => {
  const h = createHash('sha1').update(`princess-persona:${key}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`.toUpperCase()
}
const pub = (key: string) => raw(`'${guid(key)}'`)
const dateOnly = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const out: string[] = []
function insert(table: string, cols: string[], rows: V[][]): void {
  if (!rows.length) return
  out.push(`-- ${table}: ${rows.length} rows`)
  out.push(`INSERT INTO ${table} (${cols.map((c) => `[${c}]`).join(', ')}) VALUES`)
  out.push(rows.map((r) => `  (${r.map(v).join(', ')})`).join(',\n') + ';')
  out.push('')
}

// ---------------------------------------------------------------- the people
type Tier = 'none' | 'gold' | 'ruby' | 'platinum' | 'elite'
type Need = 'mobility' | 'hearing' | 'vision' | 'cpap' | 'oxygen' | 'serviceAnimal'
type Diet = 'vegetarian' | 'vegan' | 'glutenFree' | 'nutAllergy' | 'shellfishAllergy' | 'dairyFree' | 'halal' | 'kosher'

export interface Person {
  slug: string; first: string; last: string; age: number
  stage: StageId; /** Clock override, ISO UTC; otherwise a few hours into the stage. */ clock?: string
  tier?: Tier; sanctuary?: boolean; textSize?: string; child?: string
  needs?: Need[]; diet?: Diet[]; other?: boolean
  passport?: string | null | 'none'; scenarios?: string[]
  role: string; test: string
}

const P = (x: Person): Person => x
export const PEOPLE: Person[] = [
  // The twelve original personas.
  P({ slug: 'gerald', first: 'Gerald', last: 'Whitfield', age: 71, stage: 'seaDay', tier: 'platinum', textSize: 'large', scenarios: ['orderStock', 'planChange'], role: 'Platinum repeat guest, solo, at sea', test: 'Large text, traditional dining, a family helper, three past trips, order stock-outs and plan changes.' }),
  P({ slug: 'maria', first: 'Maria', last: 'Delgado', age: 38, stage: 'preCruise', clock: '2027-03-05T17:00:00', passport: 'none', role: 'First-time cruiser, deposit paid only', test: 'Balance due in six days, no passport recorded, check-in not yet open.' }),
  P({ slug: 'linda', first: 'Linda', last: 'Okafor', age: 66, stage: 'checkIn', tier: 'ruby', needs: ['mobility'], role: 'Accessibility guest, check-in half done', test: 'Accessible stateroom, tender assistance request, check-in open with two of six steps done.' }),
  P({ slug: 'alexander', first: 'Alexander', last: 'Reyes', age: 54, stage: 'embarkation', tier: 'elite', sanctuary: true, role: 'Sanctuary suite guest, embarking', test: 'Premier fare entitlements, check-in done, boarding pass, luggage dropped, muster not yet confirmed.' }),
  P({ slug: 'daniel', first: 'Daniel', last: 'Harper', age: 41, stage: 'cozumel', tier: 'ruby', scenarios: ['childMissing', 'chatSlow'], role: 'Harper family booker, in Cozumel', test: 'Controls two supervised children, family tour, missing-child and slow-chat scenarios.' }),
  P({ slug: 'priya', first: 'Priya', last: 'Harper', age: 39, stage: 'cozumel', tier: 'ruby', diet: ['vegetarian'], role: 'Harper family, mother', test: 'Vegetarian dining on the shared booking.' }),
  P({ slug: 'ethan', first: 'Ethan', last: 'Harper', age: 14, stage: 'cozumel', child: 'daniel', role: 'Harper family, supervised teen', test: 'Supervised account: no password, the booker views as him.' }),
  P({ slug: 'maya', first: 'Maya', last: 'Harper', age: 8, stage: 'cozumel', child: 'daniel', diet: ['nutAllergy'], role: 'Harper family, supervised child', test: 'Nut allergy, kids club check-in, supervised rules.' }),
  P({ slug: 'marcus', first: 'Marcus', last: 'Brennan', age: 43, stage: 'preCruise', clock: '2027-03-08T17:00:00', tier: 'gold', role: 'Brennan family booker, deposit paid only', test: 'Balance due in three days, excursions in the cart, nothing booked yet.' }),
  P({ slug: 'elena', first: 'Elena', last: 'Brennan', age: 40, stage: 'preCruise', clock: '2027-03-08T17:00:00', tier: 'gold', role: 'Brennan family, mother', test: 'Wants spa and wine; a second adult on a shared booking.' }),
  P({ slug: 'lucas', first: 'Lucas', last: 'Brennan', age: 6, stage: 'preCruise', clock: '2027-03-08T17:00:00', tier: 'gold', child: 'marcus', role: 'Brennan family, supervised child', test: 'Supervised child, Firefly Park age band.' }),
  P({ slug: 'sofia', first: 'Sofia', last: 'Brennan', age: 11, stage: 'preCruise', clock: '2027-03-08T17:00:00', tier: 'gold', child: 'marcus', role: 'Brennan family, supervised child', test: 'Supervised child, Neon Grove age band.' }),
  // Before a booking exists.
  P({ slug: 'nina', first: 'Nina', last: 'Castellano', age: 29, stage: 'booked', clock: '2026-11-02T15:00:00', role: 'Brand-new account', test: 'Nothing at all: empty states on every screen.' }),
  P({ slug: 'rosa', first: 'Rosa', last: 'Alvarez', age: 47, stage: 'booked', clock: '2026-11-02T15:00:00', role: 'Returning guest with a saved draft and favourites', test: 'Resume a draft, favourites list, one past trip.' }),
  P({ slug: 'hannah', first: 'Hannah', last: 'Pryce', age: 35, stage: 'booked', clock: '2026-11-02T15:00:00', role: 'Booking in progress, one of two guests entered', test: 'Draft stopped at the guests step with partial details.' }),
  P({ slug: 'theo', first: 'Theo', last: 'Lindqvist', age: 58, stage: 'booked', clock: '2026-11-02T15:00:00', tier: 'platinum', role: 'Comparing sailings with a tier and credit', test: 'Platinum discount, a future cruise credit, favourites, no booking yet.' }),
  // Booked, paying.
  P({ slug: 'owen', first: 'Owen', last: 'Bright', age: 33, stage: 'booked', clock: '2026-12-05T15:00:00', role: 'Deposit only, balance due soon', test: 'Balance due in 16 days; pay the balance flow.' }),
  P({ slug: 'priscilla', first: 'Priscilla', last: 'Nwosu', age: 45, stage: 'booked', clock: '2027-01-05T15:00:00', role: 'Payment problem', test: 'Balance payment declined and now overdue; card update flow.' }),
  P({ slug: 'victor', first: 'Victor', last: 'Salazar', age: 52, stage: 'preCruise', clock: '2027-03-01T15:00:00', other: true, passport: '2027-08-30', role: 'Passport expires too soon', test: 'Passport valid for less than six months after the cruise; documents unresolved.' }),
  P({ slug: 'edith', first: 'Edith', last: 'Marsh', age: 63, stage: 'preCruise', clock: '2027-03-01T15:00:00', passport: 'none', role: 'Travel-agent booking', test: 'Agent booking, documents handled by the agent.' }),
  P({ slug: 'dev', first: 'Dev', last: 'Anand', age: 40, stage: 'preCruise', clock: '2027-03-14T15:00:00', role: 'Changed sailing, price-drop credit owed', test: 'Moved from the 28 Feb sailing; photo package bought before its price fell.' }),
  // Parties.
  P({ slug: 'jordan', first: 'Jordan', last: 'Ellis', age: 31, stage: 'roatan', role: 'Honeymoon, booker', test: 'Occasion booking, mini-suite, Premier fare, a couple.' }),
  P({ slug: 'casey', first: 'Casey', last: 'Ellis', age: 30, stage: 'roatan', role: 'Honeymoon, partner', test: 'Second adult on an occasion booking.' }),
  P({ slug: 'sam', first: 'Sam', last: 'Okoro', age: 36, stage: 'seaDay', scenarios: ['chatSlow'], role: 'Friend, separate cabin', test: 'Travel-party chat with a friend who has another booking.' }),
  P({ slug: 'taylor', first: 'Taylor', last: 'Quinn', age: 37, stage: 'seaDay', role: 'Friend, separate cabin', test: 'The other half of the friends chat.' }),
  P({ slug: 'ruth', first: 'Ruth', last: 'Abernathy', age: 77, stage: 'belize', needs: ['hearing', 'mobility'], scenarios: ['belizeTender', 'clockChange'], role: 'Multigenerational, with a helper', test: 'Tender day with mobility assistance, the Belize clock change, an active helper.' }),
  P({ slug: 'paul', first: 'Paul', last: 'Abernathy', age: 49, stage: 'belize', role: "Ruth's helper", test: 'Signs in as a helper with view and documents permission over Ruth.' }),
  // Special needs.
  P({ slug: 'mei', first: 'Mei', last: 'Tanaka', age: 61, stage: 'seaDay2', needs: ['hearing'], diet: ['halal'], scenarios: ['illness'], role: 'Hearing and halal, ship illness notice', test: 'Illness notice, hearing support, a revoked helper.' }),
  P({ slug: 'colin', first: 'Colin', last: 'Fisher', age: 68, stage: 'embarkation', needs: ['cpap', 'serviceAnimal'], diet: ['kosher'], scenarios: ['terminalChange', 'phoneDead'], role: 'CPAP, service animal, kosher', test: 'Terminal change on embarkation day, a dead phone.' }),
  P({ slug: 'bea', first: 'Bea', last: 'Sorensen', age: 44, stage: 'roatan', needs: ['vision'], diet: ['nutAllergy', 'shellfishAllergy', 'vegan'], scenarios: ['lateInPort'], role: 'Severe allergies and vegan, low vision', test: 'Allergy carried to dining, late back from port.' }),
  // After the cruise.
  P({ slug: 'frank', first: 'Frank', last: 'Dalton', age: 59, stage: 'disembark', tier: 'ruby', role: 'Disembarkation morning, walk-off chosen', test: 'Early walk-off, customs not filled in, bill not settled.' }),
  P({ slug: 'grace', first: 'Grace', last: 'Imani', age: 42, stage: 'postCruise', tier: 'ruby', role: 'Home again, disputed bill line', test: 'Open billing case, rebook hold, feedback given, loyalty tier change.' }),
  P({ slug: 'harold', first: 'Harold', last: 'Quist', age: 74, stage: 'postCruise', role: 'Home again, nothing done', test: 'Customs not done, feedback not given, final bill unsettled.' }),
  P({ slug: 'cora', first: 'Cora', last: 'Bell', age: 51, stage: 'preCruise', clock: '2027-02-10T15:00:00', role: 'Cancelled booking', test: 'Cancelled with a fee and a partial refund.' }),
]

// ---------------------------------------------------------------- the bookings
type Plan = 'full' | 'depBal' | 'deposit' | 'declined' | 'cancelled'
type Checkin = 'none' | 'half' | 'done'
interface Tour { ex: string; who: string[] }
interface Dine { venue: string; day: number; time: string; who: string[] }
interface Buy { item: string; who: string[]; credited?: number }
interface Booking {
  key: string; number: string; booker: string; guests: string[]; category: CategoryId; fare: FareId
  dining: 'anytime' | 'early' | 'late'; occasion?: 'none' | 'birthday' | 'anniversary' | 'honeymoon' | 'other'
  plan: Plan; finalDays?: number; kind?: 'direct' | 'agent'; agent?: string; accessible?: boolean
  checkin?: Checkin; luggage?: 'dropped' | 'delivered'; muster?: boolean
  tours?: Tour[]; cart?: Tour[]; dine?: Dine[]; buys?: Buy[]; folio?: boolean
  assist?: { who: string; kind: string; note: string }
  after?: 'walkoff' | 'billing' | 'quiet'
}
const BOOKINGS: Booking[] = [
  { key: 'gerald', number: 'PC163342', booker: 'gerald', guests: ['gerald'], category: 'balcony', fare: 'standard', dining: 'early', plan: 'depBal', checkin: 'done', luggage: 'delivered', muster: true, tours: [{ ex: 'coz-ruins', who: ['gerald'] }], dine: [{ venue: 'crown', day: 2, time: '19:00', who: ['gerald'] }], buys: [{ item: 'wifi', who: ['gerald'] }], folio: true },
  { key: 'maria', number: 'PC179254', booker: 'maria', guests: ['maria'], category: 'oceanview', fare: 'standard', dining: 'anytime', plan: 'deposit', finalDays: 10, checkin: 'none' },
  { key: 'linda', number: 'PC195166', booker: 'linda', guests: ['linda'], category: 'balcony', fare: 'standard', dining: 'anytime', plan: 'depBal', accessible: true, checkin: 'half', assist: { who: 'linda', kind: 'tender', note: 'Wheelchair user; needs level boarding for tenders at Belize and Roatan.' } },
  { key: 'alexander', number: 'PC211078', booker: 'alexander', guests: ['alexander'], category: 'miniSuite', fare: 'premier', dining: 'late', plan: 'depBal', checkin: 'done', luggage: 'dropped' },
  { key: 'daniel', number: 'PC243902', booker: 'daniel', guests: ['daniel', 'priya', 'ethan', 'maya'], category: 'balcony', fare: 'plus', dining: 'early', plan: 'depBal', checkin: 'done', luggage: 'delivered', muster: true, tours: [{ ex: 'coz-beach', who: ['daniel', 'priya', 'ethan', 'maya'] }], dine: [{ venue: 'sabatini', day: 4, time: '19:30', who: ['daniel', 'priya'] }], folio: true },
  { key: 'marcus', number: 'PC259814', booker: 'marcus', guests: ['marcus', 'elena', 'lucas', 'sofia'], category: 'balcony', fare: 'standard', dining: 'early', plan: 'deposit', finalDays: 10, checkin: 'none', cart: [{ ex: 'bze-reef', who: ['marcus', 'elena', 'sofia'] }, { ex: 'coz-snorkel', who: ['marcus', 'elena', 'sofia'] }] },
  { key: 'owen', number: 'PC301776', booker: 'owen', guests: ['owen'], category: 'interior', fare: 'standard', dining: 'anytime', plan: 'deposit', checkin: 'none' },
  { key: 'priscilla', number: 'PC317688', booker: 'priscilla', guests: ['priscilla'], category: 'oceanview', fare: 'plus', dining: 'late', plan: 'declined', checkin: 'none' },
  { key: 'victor', number: 'PC333500', booker: 'victor', guests: ['victor'], category: 'interior', fare: 'standard', dining: 'anytime', plan: 'depBal', checkin: 'none' },
  { key: 'edith', number: 'AG7P31BK', booker: 'edith', guests: ['edith'], category: 'oceanview', fare: 'standard', dining: 'early', plan: 'full', kind: 'agent', agent: 'Harbour Travel', checkin: 'none' },
  { key: 'dev', number: 'PC365324', booker: 'dev', guests: ['dev'], category: 'balcony', fare: 'standard', dining: 'anytime', plan: 'depBal', checkin: 'none', buys: [{ item: 'photo', who: ['dev'], credited: 3000 }] },
  { key: 'jordan', number: 'PC381236', booker: 'jordan', guests: ['jordan', 'casey'], category: 'miniSuite', fare: 'premier', dining: 'anytime', occasion: 'honeymoon', plan: 'depBal', checkin: 'done', luggage: 'delivered', muster: true, dine: [{ venue: 'love', day: 5, time: '20:00', who: ['jordan', 'casey'] }], folio: true },
  { key: 'sam', number: 'PC397148', booker: 'sam', guests: ['sam'], category: 'oceanview', fare: 'standard', dining: 'anytime', plan: 'depBal', checkin: 'done', luggage: 'delivered', muster: true, folio: true },
  { key: 'taylor', number: 'PC413060', booker: 'taylor', guests: ['taylor'], category: 'interior', fare: 'standard', dining: 'anytime', plan: 'depBal', checkin: 'done', luggage: 'delivered', muster: true, folio: true },
  { key: 'ruth', number: 'PC428972', booker: 'ruth', guests: ['ruth', 'paul'], category: 'balcony', fare: 'standard', dining: 'early', plan: 'depBal', checkin: 'done', luggage: 'delivered', muster: true, assist: { who: 'ruth', kind: 'tender', note: 'Walker. Needs a seat near the tender door and help on the gangway.' }, tours: [{ ex: 'bze-walk', who: ['ruth', 'paul'] }], folio: true },
  { key: 'mei', number: 'PC444884', booker: 'mei', guests: ['mei'], category: 'oceanview', fare: 'standard', dining: 'early', plan: 'depBal', checkin: 'done', luggage: 'delivered', muster: true, folio: true },
  { key: 'colin', number: 'PC460796', booker: 'colin', guests: ['colin'], category: 'balcony', fare: 'standard', dining: 'early', plan: 'depBal', checkin: 'done', luggage: 'dropped', assist: { who: 'colin', kind: 'equipment', note: 'CPAP machine needs a power point beside the bed. Service dog travelling with me.' } },
  { key: 'bea', number: 'PC476708', booker: 'bea', guests: ['bea'], category: 'interior', fare: 'plus', dining: 'late', plan: 'depBal', checkin: 'done', luggage: 'delivered', muster: true, tours: [{ ex: 'coz-beach', who: ['bea'] }], folio: true },
  { key: 'frank', number: 'PC492620', booker: 'frank', guests: ['frank'], category: 'balcony', fare: 'standard', dining: 'anytime', plan: 'depBal', checkin: 'done', luggage: 'delivered', muster: true, folio: true, after: 'walkoff' },
  { key: 'grace', number: 'PC508532', booker: 'grace', guests: ['grace'], category: 'balcony', fare: 'plus', dining: 'anytime', plan: 'depBal', checkin: 'done', luggage: 'delivered', muster: true, folio: true, after: 'billing' },
  { key: 'harold', number: 'PC524444', booker: 'harold', guests: ['harold'], category: 'oceanview', fare: 'standard', dining: 'early', plan: 'depBal', checkin: 'done', luggage: 'delivered', muster: true, folio: true, after: 'quiet' },
  { key: 'cora', number: 'PC540356', booker: 'cora', guests: ['cora'], category: 'interior', fare: 'standard', dining: 'anytime', plan: 'cancelled', checkin: 'none' },
]

// ---------------------------------------------------------------- derived facts
const person = (slug: string): Person => PEOPLE.find((p) => p.slug === slug)!
const bookingOf = (slug: string): Booking | undefined => BOOKINGS.find((b) => b.guests.includes(slug))
const isAdult = (slug: string) => person(slug).age >= 18
const dobOf = (p: Person) => `${2027 - p.age - 1}-${String(3 + (p.slug.length % 8)).padStart(2, '0')}-${String(2 + (p.first.length * 3) % 25).padStart(2, '0')}`
const clockOf = (p: Person): string => p.clock ?? new Date(stageAtMs(p.stage, 3)).toISOString().slice(0, 19)
const accountNumber = (i: number) => String(4_100_000_000 + (i + 1) * 7919)
const emailOf = (slug: string) => `${slug}@${EMAIL_DOMAIN}`
export const hashPassword = (slug: string): string => {
  const salt = createHash('sha256').update(`princess-demo-salt:${slug}`).digest().subarray(0, 16)
  const hash = pbkdf2Sync(DEMO_PASSWORD, salt, PBKDF2_ITERATIONS, 64, 'sha512')
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`
}

const sailingLabel = (id: string) => SAILINGS.find((s) => s.id === id)!.departure
const finalDaysOf = (b: Booking) => b.finalDays ?? 90
const totalOf = (b: Booking) => bookingQuote(REF.id, b.category, b.guests.length, b.fare)!.total
const planOf = (b: Booking) => paymentPlan(totalOf(b), DEPARTURE, finalDaysOf(b))
const loyaltyNo = (slug: string) => `PC${String(1_000_000 + (PEOPLE.findIndex((p) => p.slug === slug) + 1) * 7919).padStart(7, '0')}`
const hasTier = (p: Person) => !!p.tier && p.tier !== 'none'
const daysCounted: Record<Tier, number> = { none: 0, gold: 30, ruby: 100, platinum: 150, elite: 300 }

const cabinNumbers = new Map<string, string>()
for (const b of BOOKINGS) {
  const all = cabinsFor(REF.id, b.category)
  const taken = new Set(cabinNumbers.values())
  const pick = (b.accessible ? all.filter((c) => c.accessible) : all.filter((c) => !c.accessible)).find((c) => !taken.has(c.number))
  cabinNumbers.set(b.key, pick?.number ?? all[0].number)
}

// ---------------------------------------------------------------- file builders
const header = (title: string, withIds: boolean): string => {
  const lines = ['/*', `  Persona data: ${title}.`, '  GENERATED by `npm run db:persona:gen` from scripts/persona-seed.ts. Do not edit by hand.', '  Run through db/seed/personas/run-all.sql (it resets first); the files do not tolerate a second run alone.', '  Plain ASCII; run after the schema and the reference seeds.', '*/', 'SET NOCOUNT ON;', 'SET QUOTED_IDENTIFIER ON;', 'SET XACT_ABORT ON;', 'BEGIN TRANSACTION;', '']
  if (withIds) {
    lines.push('DECLARE')
    const decls = [...PEOPLE.map((p) => `  @u_${p.slug.replace(/-/g, '_')} BIGINT = (SELECT Id FROM dbo.Users WHERE Slug = N'${p.slug}')`)]
    if (withIds) decls.push(...BOOKINGS.map((b) => `  @b_${b.key} BIGINT = (SELECT Id FROM dbo.Bookings WHERE Number = '${b.number}')`))
    lines.push(decls.join(',\n') + ';', '')
  }
  return lines.join('\n')
}
const footer = 'COMMIT TRANSACTION;\n'
const collect = (fn: () => void): string => { out.length = 0; fn(); return out.join('\n') }

function resetFile(): string {
  const slugs = PEOPLE.map((p) => `N'${p.slug}'`).join(', ')
  return [
    '/*', '  Persona data: reset. Removes every seeded demo person and everything they own; reference data is untouched.',
    '  GENERATED by `npm run db:persona:gen`. A person is a seeded person when their Slug is in the list below.', '*/',
    'SET NOCOUNT ON;', 'SET QUOTED_IDENTIFIER ON;', 'SET XACT_ABORT ON;', 'BEGIN TRANSACTION;', '',
    'DECLARE @seed TABLE (Id BIGINT NOT NULL PRIMARY KEY);',
    `INSERT INTO @seed SELECT Id FROM dbo.Users WHERE Slug IN (${slugs});`, '',
    '-- Bookings first: payments, tours, check-in, folio, cases and the rest cascade from them.',
    'DELETE FROM dbo.Bookings WHERE BookerUserId IN (SELECT Id FROM @seed);',
    '-- Rows that name a seeded person only as the actor do not cascade; clear them.',
    'DELETE FROM dbo.HistoryEntries WHERE ByUserId IN (SELECT Id FROM @seed);',
    'DELETE FROM dbo.ConsentChoices WHERE ChangedByUserId IN (SELECT Id FROM @seed);',
    'DELETE FROM dbo.HelperLinks WHERE HelperUserId IN (SELECT Id FROM @seed);',
    'DELETE FROM dbo.MusterConfirmations WHERE ByUserId IN (SELECT Id FROM @seed);',
    'DELETE FROM dbo.Payments WHERE UserId IN (SELECT Id FROM @seed);',
    'DELETE FROM dbo.FolioLines WHERE UserId IN (SELECT Id FROM @seed);',
    'DELETE FROM dbo.BookingGuestDetails WHERE UserId IN (SELECT Id FROM @seed);',
    '-- Supervised children before their bookers (Users.BookerUserId does not cascade).',
    'DELETE FROM dbo.Users WHERE Id IN (SELECT Id FROM @seed) AND IsSupervised = 1;',
    'DELETE FROM dbo.Users WHERE Id IN (SELECT Id FROM @seed);', '',
    footer,
  ].join('\n')
}

function usersFile(): string {
  const body = collect(() => {
    const row = (p: Person, i: number): V[] => [
      pub(`user:${p.slug}`), p.slug, accountNumber(i), p.child ? null : emailOf(p.slug), p.child ? null : hashPassword(p.slug), 'guest', true, !!p.child,
      p.child ? raw(`(SELECT Id FROM dbo.Users WHERE Slug = N'${p.child}')`) : null, p.tier ?? 'none', !!p.sanctuary, p.textSize ?? 'standard',
    ]
    const cols = ['PublicId', 'Slug', 'AccountNumber', 'Email', 'PasswordHash', 'Role', 'IsDemo', 'IsSupervised', 'BookerUserId', 'Tier', 'Sanctuary', 'TextSize']
    insert('dbo.Users', cols, PEOPLE.map((p, i) => ({ p, i })).filter((x) => !x.p.child).map((x) => row(x.p, x.i)))
    insert('dbo.Users', cols, PEOPLE.map((p, i) => ({ p, i })).filter((x) => x.p.child).map((x) => row(x.p, x.i)))
    out.push('DECLARE')
    out.push(PEOPLE.map((p) => `  @u_${p.slug} BIGINT = (SELECT Id FROM dbo.Users WHERE Slug = N'${p.slug}')`).join(',\n') + ';', '')

    insert('dbo.Profiles', ['UserId', 'FirstName', 'LastName', 'Dob', 'Phone', 'Citizenship', 'Bedding', 'SpecialRequests', 'EmergencyName', 'EmergencyPhone', 'EmergencyRelationship', 'Street', 'City', 'Region', 'Postcode', 'Country'],
      PEOPLE.map((p, i) => {
        const adult = isAdult(p.slug)
        const lead = adult && !PEOPLE.some((o) => o.child === p.slug)
        return [U(p.slug), p.first, p.last, dt(dobOf(p)), adult ? `+1 305 555 ${String(1000 + i * 37).slice(-4)}` : null, p.other ? 'other' : 'us', 'noPreference',
          p.needs?.includes('mobility') ? 'Stateroom close to the elevators, please.' : '', adult ? 'Alex Contact' : (p.child ? 'See booker' : ''), adult ? '+1 305 555 0100' : '', adult ? 'Friend' : '',
          lead ? `${100 + i} Harbour Road` : null, lead ? 'Fort Lauderdale' : null, lead ? 'FL' : null, lead ? '33301' : null, lead ? 'United States' : null] as V[]
      }))
    insert('dbo.ProfileTags', ['UserId', 'Kind', 'Code'], PEOPLE.flatMap((p) => [...(p.diet ?? []).map((c) => [U(p.slug), 'dietary', c] as V[]), ...(p.needs ?? []).map((c) => [U(p.slug), 'need', c] as V[])]))
    insert('dbo.Loyalty', ['UserId', 'Number', 'DaysCounted', 'ReferralCode', 'ReferralCreditCents'], PEOPLE.filter(hasTier).map((p) => [U(p.slug), loyaltyNo(p.slug), daysCounted[p.tier!] + (p.slug === 'grace' ? 1 : 0), `REF${p.slug.toUpperCase()}`.slice(0, 12), 0]))
    insert('dbo.SavedCards', ['PublicId', 'UserId', 'Brand', 'Last4', 'Expiry', 'IsDefault'], PEOPLE.filter((p) => !p.child && (bookingOf(p.slug)?.booker === p.slug || p.slug === 'rosa' || p.slug === 'theo'))
      .map((p, i) => [pub(`card:${p.slug}`), U(p.slug), (['visa', 'mastercard', 'amex', 'discover'] as const)[i % 4], String(4000 + i * 13).slice(-4), p.slug === 'priscilla' ? '01/27' : '09/29', true] as V[]))
    insert('dbo.NotificationPrefs', ['UserId', 'Prefs'], PEOPLE.map((p) => [U(p.slug), json(p.slug === 'gerald' ? { ...DEFAULT_PREFS, quiet: { on: true, from: '21:00', to: '07:00' } } : DEFAULT_PREFS)]))
    insert('dbo.ConsentChoices', ['UserId', 'ConsentId', 'On', 'ChangedByUserId', 'At'], PEOPLE.flatMap((p) => {
      const by = p.child ? p.child : p.slug
      return [['improve', !p.child && p.slug !== 'gerald'], ['marketingEmail', ['rosa', 'theo', 'maria'].includes(p.slug)], ...(p.child ? [['parent', true]] : [])]
        .map(([id, on]) => [U(p.slug), id as string, on as boolean, U(by), ts(Date.parse('2026-09-15T14:00:00Z'))] as V[])
    }))
    insert('demo.DemoState', ['UserId', 'ClockOffsetSeconds', 'ClockSpeed', 'ActiveScenarios'],
      PEOPLE.map((p) => [U(p.slug), raw(`DATEDIFF_BIG(SECOND, SYSUTCDATETIME(), CAST('${clockOf(p)}' AS DATETIME2(0)))`), 1, json(p.scenarios ?? [])]))

    const docs: V[][] = []
    for (const p of PEOPLE) {
      if (!bookingOf(p.slug) && !['rosa', 'theo'].includes(p.slug)) continue
      if (p.passport === 'none') continue
      if (!isAdult(p.slug) && p.age < 16) docs.push([U(p.slug), 'birthCertificate', null])
      else docs.push([U(p.slug), 'passport', dt(typeof p.passport === 'string' ? p.passport : '2031-06-30')])
    }
    insert('dbo.GuestDocuments', ['UserId', 'Doc', 'Expires'], docs)

    const trips: V[][] = []
    const pastBy: Record<string, [string, string, string, number][]> = {
      gerald: [['Alaska Inside Passage', 'Discovery Princess', '2024-06-09', 7], ['Panama Canal', 'Emerald Princess', '2023-01-14', 10], ['Eastern Caribbean', 'Caribbean Princess', '2019-11-03', 7]],
      linda: [['Mexican Riviera', 'Royal Princess', '2025-02-16', 7]],
      alexander: [['Mediterranean', 'Sky Princess', '2025-09-07', 10], ['Hawaii', 'Star Princess', '2024-03-02', 14]],
      daniel: [['Bahamas', 'Regal Princess', '2025-06-22', 4]], rosa: [['Mexican Riviera', 'Royal Princess', '2025-10-12', 7]],
      theo: [['Alaska Inside Passage', 'Discovery Princess', '2025-07-06', 7], ['Hawaii', 'Star Princess', '2024-01-14', 14]],
    }
    for (const [slug, list] of Object.entries(pastBy)) list.forEach(([title, ship, dep, nights], n) => trips.push([`past-${slug}-${n + 1}`, U(slug), title, ship, dt(dep), nights, false, 150_000 * nights]))
    insert('dbo.PastTrips', ['Id', 'UserId', 'Title', 'Ship', 'Departure', 'Nights', 'Cancelled', 'FareCents'], trips)
    insert('dbo.PastTripDocs', ['PastTripId', 'Doc', 'Ready'], trips.flatMap((t) => [[t[0], 'fareReceipt', true], [t[0], 'folioStatement', true]] as V[][]))
    insert('dbo.FutureCruiseCredits', ['PublicId', 'UserId', 'OriginalCents', 'RemainingCents', 'ExpiresOn', 'Source'], [
      [pub('fcc:theo'), U('theo'), 150_000, 150_000, dt('2027-11-30'), 'Cancelled cruise 2025'], [pub('fcc:grace'), U('grace'), 40_000, 40_000, dt('2028-03-31'), 'Service recovery']])
    insert('dbo.Favourites', ['UserId', 'ItemKey', 'Position'], [
      ...['excursion:coz-snorkel', 'excursion:bze-reef', 'sailing:sun-2027-03-21'].map((k, i) => [U('rosa'), k, i] as V[]),
      ...['sailing:sun-2027-02-28', 'sailing:sun-2027-03-21', 'category:miniSuite'].map((k, i) => [U('theo'), k, i] as V[]),
      [U('gerald'), 'venue:crown', 0], [U('maria'), 'excursion:coz-beach', 0]])
    insert('dbo.HelperLinks', ['PublicId', 'GuestUserId', 'HelperName', 'HelperUserId', 'Relationship', 'Permissions', 'Status', 'ChangedAt'], [
      [pub('helper:gerald'), U('gerald'), 'Susan Cole', null, 'Daughter', 'view,documents', 'active', ts(Date.parse('2026-08-02T12:00:00Z'))],
      [pub('helper:ruth'), U('ruth'), 'Paul Abernathy', U('paul'), 'Son', 'view,documents,payments', 'active', ts(Date.parse('2026-09-10T12:00:00Z'))],
      [pub('helper:mei'), U('mei'), 'Lin Tanaka', null, 'Nephew', 'view', 'revoked', ts(Date.parse('2026-10-01T12:00:00Z'))],
      [pub('helper:victor'), U('victor'), 'Marta Salazar', null, 'Sister', 'view,documents', 'requested', ts(Date.parse('2027-02-20T12:00:00Z'))]])
    insert('dbo.SupportTickets', ['PublicId', 'UserId', 'Kind', 'Status', 'Detail', 'At'], [
      [pub('ticket:priscilla'), U('priscilla'), 'callback', 'open', 'My card was declined but it works elsewhere. Please call me.', ts(Date.parse('2026-12-21T16:00:00Z'))],
      [pub('ticket:victor'), U('victor'), 'email', 'inProgress', 'Can I still sail with a passport that expires in August?', ts(Date.parse('2027-02-25T16:00:00Z'))]])
    insert('dbo.HistoryEntries', ['PublicId', 'UserId', 'ByUserId', 'What', 'Detail', 'At'], [
      [pub('hist:gerald1'), U('gerald'), U('gerald'), 'helper', 'Added Susan Cole as a helper', ts(Date.parse('2026-08-02T12:00:00Z'))],
      [pub('hist:dev1'), U('dev'), U('dev'), 'trip', 'Moved the booking from the 28 Feb 2027 sailing to 21 Mar 2027', ts(Date.parse('2027-01-18T12:00:00Z'))],
      [pub('hist:victor1'), U('victor'), U('victor'), 'documents', 'Added passport (expires 30 Aug 2027)', ts(Date.parse('2027-02-20T12:00:00Z'))]])
    insert('dbo.Notices', ['PublicId', 'UserId', 'Kind', 'Severity', 'Title', 'Body', 'LinkRoute', 'ReadAt', 'At'], [
      [pub('n:maria'), U('maria'), 'payments', 'important', 'Your balance is due on 11 March', 'Pay the balance by 11 March to keep your stateroom.', '/me/payments', null, ts(Date.parse('2027-03-04T12:00:00Z'))],
      [pub('n:marcus'), U('marcus'), 'payments', 'important', 'Your balance is due on 11 March', 'Pay the balance by 11 March to keep your stateroom.', '/me/payments', null, ts(Date.parse('2027-03-07T12:00:00Z'))],
      [pub('n:owen'), U('owen'), 'payments', 'info', 'Balance due 21 December', 'Your balance is due in 16 days.', '/me/payments', null, ts(Date.parse('2026-12-05T12:00:00Z'))],
      [pub('n:priscilla'), U('priscilla'), 'payments', 'urgent', 'Your payment was declined', 'We could not take your balance. Update your card to keep your booking.', '/me/payments', null, ts(Date.parse('2026-12-21T12:00:00Z'))],
      [pub('n:victor'), U('victor'), 'documents', 'urgent', 'Your passport expires too soon', 'It must be valid for six months after the cruise ends.', '/me/documents', null, ts(Date.parse('2027-02-20T12:00:00Z'))],
      [pub('n:linda'), U('linda'), 'checkin', 'important', 'Check-in is open', 'Finish check-in for a smooth arrival.', '/', null, ts(Date.parse('2027-03-18T12:00:00Z'))],
      [pub('n:mei'), U('mei'), 'critical', 'urgent', 'Health notice from the ship', 'Some guests have a stomach illness. Wash your hands often and tell Guest Services if you feel unwell.', '/aboard/health', null, ts(stageAtMs('seaDay2', 2))],
      [pub('n:colin'), U('colin'), 'critical', 'important', 'Terminal change', 'Embarkation is now at Terminal 25, not Terminal 21.', '/', null, ts(stageAtMs('embarkation', 1))],
      [pub('n:dev'), U('dev'), 'offers', 'info', 'Photo package price dropped', 'You have a credit of $30.00 on your photo package.', '/me/packages', null, ts(Date.parse('2027-03-12T12:00:00Z'))]])
    insert('dbo.AccessLog', ['UserId', 'Actor', 'Purpose', 'At'], [[U('gerald'), 'Guest Services', 'Cabin change request', ts(Date.parse('2027-03-23T09:00:00Z'))]])
  })
  return header('users, profiles, cards, documents, helpers, notices and the demo clock', false) + body + '\n' + footer
}

function bookingsFile(): string {
  const body = collect(() => {
    const bk = (b: Booking) => {
      const plan = planOf(b)
      const p = person(b.booker)
      const confirmed = Date.parse(`${plan.booked}T15:00:00Z`)
      const cancelled = b.plan === 'cancelled'
      const fee = cancelled ? Math.round(plan.total * 0.25) : null
      return [pub(`booking:${b.key}`), b.number, b.kind ?? 'direct', b.agent ?? null, U(b.booker), REF.id, b.category, cabinNumbers.get(b.key)!, b.fare, cancelled ? 'cancelled' : 'confirmed',
        b.dining, b.occasion ?? 'none', plan.total, plan.deposit, dt(plan.finalDue), finalDaysOf(b), hasTier(p) ? loyaltyNo(p.slug) : null, 0, 0, emailOf(b.booker), '+1 305 555 0142',
        ts(confirmed), cancelled ? ts(Date.parse('2027-02-08T15:00:00Z')) : null, fee, cancelled ? plan.total - fee! : null] as V[]
    }
    out.push('DECLARE')
    out.push(PEOPLE.map((p) => `  @u_${p.slug} BIGINT = (SELECT Id FROM dbo.Users WHERE Slug = N'${p.slug}')`).join(',\n') + ';', '')
    insert('dbo.Bookings', ['PublicId', 'Number', 'Kind', 'AgentName', 'BookerUserId', 'SailingId', 'CategoryId', 'CabinNumber', 'FareId', 'Status', 'Dining', 'Occasion', 'TotalCents', 'DepositCents', 'FinalDueDate', 'FinalPaymentDays', 'LoyaltyNumber', 'DiscountCents', 'CreditUsedCents', 'ContactEmail', 'ContactPhone', 'ConfirmedAt', 'CancelledAt', 'CancelFeeCents', 'CancelRefundCents'], BOOKINGS.map(bk))
    out.push('DECLARE')
    out.push(BOOKINGS.map((b) => `  @b_${b.key} BIGINT = (SELECT Id FROM dbo.Bookings WHERE Number = '${b.number}')`).join(',\n') + ';', '')

    insert('dbo.BookingGuests', ['BookingId', 'UserId', 'Seq', 'IsLead', 'Printed'], BOOKINGS.flatMap((b) => b.guests.map((g, i) => [B(b.key), U(g), i + 1, i === 0, `${person(g).last.toUpperCase()}/${person(g).first.toUpperCase()}`] as V[])))
    insert('dbo.BookingGuestDetails', ['BookingId', 'Seq', 'UserId', 'FirstName', 'LastName', 'Dob', 'Gender', 'Citizenship', 'DietaryStatus', 'AllergyNote'], BOOKINGS.flatMap((b) => b.guests.map((g, i) => {
      const p = person(g)
      return [B(b.key), i + 1, U(g), p.first, p.last, dt(dobOf(p)), 'X', p.other ? 'other' : 'us', p.diet?.length ? 'some' : 'none', p.diet?.some((d) => d.endsWith('Allergy')) ? 'Severe allergy: see dietary list.' : ''] as V[]
    })))
    insert('dbo.BookingGuestTags', ['BookingId', 'Seq', 'Kind', 'Code'], BOOKINGS.flatMap((b) => b.guests.flatMap((g, i) => {
      const p = person(g)
      return [...(p.diet ?? []).map((c) => [B(b.key), i + 1, 'dietary', c] as V[]), ...(p.needs ?? []).map((c) => [B(b.key), i + 1, 'need', c] as V[])]
    })))
    insert('dbo.Acceptances', ['BookingId', 'LegalId', 'Version', 'At'], BOOKINGS.flatMap((b) => ['terms', 'health', 'age'].map((l) => [B(b.key), l, 202610, ts(Date.parse(`${planOf(b).booked}T15:00:00Z`))] as V[])))

    // Payments and their parts. The reference is unique so later scripts can find the row.
    const pay: { ref: string; b: Booking; label: string; cents: number; at: number; status?: string }[] = []
    for (const b of BOOKINGS) {
      const plan = planOf(b)
      const booked = Date.parse(`${plan.booked}T15:00:00Z`)
      const balanceAt = Date.parse(`${addIso(plan.finalDue, -5)}T15:00:00Z`)
      if (b.plan === 'full' || b.plan === 'cancelled') pay.push({ ref: `PAY-${b.number}-F`, b, label: 'full', cents: plan.total, at: booked })
      else pay.push({ ref: `PAY-${b.number}-D`, b, label: 'deposit', cents: plan.deposit, at: booked })
      if (b.plan === 'depBal') pay.push({ ref: `PAY-${b.number}-B`, b, label: 'balance', cents: plan.balance, at: balanceAt })
      if (b.plan === 'declined') pay.push({ ref: `PAY-${b.number}-X`, b, label: 'balance', cents: plan.balance, at: Date.parse(`${addIso(plan.finalDue, -1)}T15:00:00Z`), status: 'declined' })
      if (b.plan === 'cancelled') pay.push({ ref: `PAY-${b.number}-R`, b, label: 'refund', cents: -(plan.total - Math.round(plan.total * 0.25)), at: Date.parse('2027-02-08T15:00:00Z') })
      for (const t of b.tours ?? []) {
        const x = EXCURSIONS.find((e) => e.id === t.ex)!
        pay.push({ ref: `PAY-${b.number}-T-${t.ex}`, b, label: 'tour', cents: t.who.reduce((n, g) => n + guestPrice(x, person(g).age), 0), at: Date.parse('2027-02-14T15:00:00Z') })
      }
      for (const [i, u] of (b.buys ?? []).entries()) pay.push({ ref: `PAY-${b.number}-P${i + 1}`, b, label: 'purchase', cents: purchaseTotal(u), at: Date.parse('2027-02-20T15:00:00Z') })
    }
    insert('dbo.Payments', ['PublicId', 'BookingId', 'UserId', 'Label', 'AmountCents', 'At', 'Reference', 'Status'], pay.map((x) => [pub(`pay:${x.ref}`), B(x.b.key), U(x.b.booker), x.label, x.cents, ts(x.at), x.ref, x.status ?? 'captured']))
    insert('dbo.PaymentParts', ['PaymentId', 'Seq', 'Method', 'CardId', 'CardBrand', 'Last4', 'Cents', 'ChallengeUsed'], pay.filter((x) => x.label !== 'refund').map((x) => [
      raw(`(SELECT Id FROM dbo.Payments WHERE Reference = '${x.ref}')`), 1, 'card', raw(`(SELECT Id FROM dbo.SavedCards WHERE UserId = @u_${x.b.booker})`),
      raw(`(SELECT Brand FROM dbo.SavedCards WHERE UserId = @u_${x.b.booker})`), raw(`(SELECT Last4 FROM dbo.SavedCards WHERE UserId = @u_${x.b.booker})`), x.cents, false]))

    // Drafts: one saved, one half filled.
    insert('dbo.BookingDrafts', ['Id', 'UserId', 'SailingId', 'CategoryId', 'Guests', 'CabinMode', 'FareId', 'Dining', 'Occasion', 'UseCredit', 'Accepted', 'People', 'Contact', 'Step', 'UpdatedAt'], [
      ['draft-rosa-0a1b2c3d4e5f60718293a4b5', U('rosa'), 'sun-2027-03-21', 'balcony', 2, 'guaranteed', 'plus', 'early', 'anniversary', false, json({}),
        json([{ first: 'Rosa', last: 'Alvarez', dob: dobOf(person('rosa')), gender: 'F', citizenship: 'us' }, { first: 'Miguel', last: 'Alvarez', dob: '1977-06-14', gender: 'M', citizenship: 'us' }]),
        json({ email: emailOf('rosa'), phone: '+1 305 555 0188' }), 'review', ts(Date.parse('2026-10-28T18:00:00Z'))],
      ['draft-hannah-9f8e7d6c5b4a39281706f5e4', U('hannah'), 'sun-2027-03-21', 'oceanview', 2, 'guaranteed', null, null, 'none', false, json({}),
        json([{ first: 'Hannah', last: 'Pryce', dob: dobOf(person('hannah')), gender: 'F', citizenship: 'us' }, { first: '', last: '', dob: '', gender: '', citizenship: 'us' }]),
        json({ email: emailOf('hannah') }), 'guests', ts(Date.parse('2026-10-27T10:00:00Z'))]])
    insert('dbo.QuoteLocks', ['DraftId', 'LockedUntil', 'TotalCents', 'QuoteJson'], [['draft-rosa-0a1b2c3d4e5f60718293a4b5', ts(Date.parse('2026-10-30T18:00:00Z')), bookingQuote(REF.id, 'balcony', 2, 'plus')!.total, json({ sailingId: REF.id, category: 'balcony', guests: 2, fare: 'plus' })]])
  })
  return header('bookings, guests, acceptances, payments and booking drafts', false) + body + '\n' + footer
}

function purchaseTotal(u: Buy): number {
  const a = Object.values(ADD_ONS).find((x) => x.id === u.item)!
  return a.base * (a.unit === 'person' ? u.who.length : u.who.length * 7)
}

function journeyFile(): string {
  const body = collect(() => {
    out.push('DECLARE')
    out.push([...PEOPLE.map((p) => `  @u_${p.slug} BIGINT = (SELECT Id FROM dbo.Users WHERE Slug = N'${p.slug}')`), ...BOOKINGS.map((b) => `  @b_${b.key} BIGINT = (SELECT Id FROM dbo.Bookings WHERE Number = '${b.number}')`)].join(',\n') + ';', '')
    const payId = (b: Booking, suffix: string) => raw(`(SELECT Id FROM dbo.Payments WHERE Reference = 'PAY-${b.number}-${suffix}')`)
    const live = BOOKINGS.filter((b) => b.plan !== 'cancelled')

    // Pre-cruise ticks.
    const tick = (b: Booking): string[] => {
      const p = person(b.booker)
      const ids: string[] = []
      if (b.plan === 'depBal' || b.plan === 'full') ids.push('pay')
      if (['preCruise', 'checkIn', 'embarkation', 'seaDay', 'cozumel', 'belize', 'roatan', 'seaDay2', 'farewell', 'disembark', 'postCruise'].includes(p.stage) && b.checkin !== 'none') ids.push('names', 'documents', 'insurance')
      if (b.tours?.length) ids.push('tours')
      if (b.dine?.length) ids.push('dining')
      if (b.assist) ids.push('assistance')
      if (b.checkin === 'done') ids.push('checkin', 'packing', 'phone')
      return ids
    }
    insert('dbo.ChecklistTicks', ['BookingId', 'ItemId', 'Done', 'At'], live.flatMap((b) => tick(b).map((id) => [B(b.key), id, true, ts(Date.parse('2027-02-25T15:00:00Z'))] as V[])))
    insert('dbo.AssistanceRequests', ['PublicId', 'BookingId', 'GuestUserId', 'Kind', 'Note', 'Status', 'At'], live.filter((b) => b.assist).map((b) => [pub(`assist:${b.key}`), B(b.key), U(b.assist!.who), b.assist!.kind, b.assist!.note, b.key === 'ruth' ? 'confirmed' : 'received', ts(Date.parse('2027-02-27T15:00:00Z'))]))

    // Tours: booked, with guests; carts.
    const tours = live.flatMap((b) => (b.tours ?? []).map((t) => ({ b, t })))
    insert('dbo.TourBookings', ['PublicId', 'BookingId', 'ExcursionId', 'Day', 'Source', 'TotalCents', 'CreditCents', 'Status', 'PaymentId', 'At'], tours.map(({ b, t }) => {
      const x = EXCURSIONS.find((e) => e.id === t.ex)!
      return [pub(`tour:${b.key}:${t.ex}`), B(b.key), t.ex, dayOf(REF, x).day, 'pre', t.who.reduce((n, g) => n + guestPrice(x, person(g).age), 0), 0, 'booked', payId(b, `T-${t.ex}`), ts(Date.parse('2027-02-14T15:00:00Z'))] as V[]
    }))
    insert('dbo.TourBookingGuests', ['TourBookingId', 'UserId'], tours.flatMap(({ b, t }) => t.who.map((g) => [raw(`(SELECT Id FROM dbo.TourBookings WHERE PublicId = '${guid(`tour:${b.key}:${t.ex}`)}')`), U(g)] as V[])))
    const carts = live.flatMap((b) => (b.cart ?? []).map((t) => ({ b, t })))
    insert('dbo.TourCartLines', ['BookingId', 'ExcursionId'], carts.map(({ b, t }) => [B(b.key), t.ex]))
    insert('dbo.TourCartGuests', ['BookingId', 'ExcursionId', 'UserId'], carts.flatMap(({ b, t }) => t.who.map((g) => [B(b.key), t.ex, U(g)] as V[])))

    // Dining.
    const dines = live.flatMap((b) => (b.dine ?? []).map((d) => ({ b, d })))
    insert('dbo.DiningReservations', ['PublicId', 'BookingId', 'VenueId', 'Day', 'TimeLocal', 'Note', 'ChargeCents', 'Status'], dines.map(({ b, d }) => [pub(`dine:${b.key}:${d.venue}`), B(b.key), d.venue, d.day, tm(d.time), b.occasion === 'honeymoon' ? 'Honeymoon: a quiet table if possible.' : '', d.venue === 'eclipse' ? 0 : 4500 * d.who.length, 'booked']))
    insert('dbo.DiningReservationGuests', ['ReservationId', 'UserId', 'Covered'], dines.flatMap(({ b, d }) => d.who.map((g) => [raw(`(SELECT Id FROM dbo.DiningReservations WHERE PublicId = '${guid(`dine:${b.key}:${d.venue}`)}')`), U(g), b.fare !== 'standard'] as V[])))

    // Package and add-on purchases.
    const buys = live.flatMap((b) => (b.buys ?? []).map((u, i) => ({ b, u, i })))
    insert('dbo.Purchases', ['PublicId', 'BookingId', 'Kind', 'ItemId', 'Units', 'UnitCents', 'TotalCents', 'Status', 'CreditedCents', 'PaymentId', 'At'], buys.map(({ b, u, i }) => {
      const a = Object.values(ADD_ONS).find((x) => x.id === u.item)!
      return [pub(`buy:${b.key}:${u.item}`), B(b.key), 'addOn', u.item, u.who.length, a.base, purchaseTotal(u), 'active', u.credited ?? 0, payId(b, `P${i + 1}`), ts(Date.parse('2027-02-20T15:00:00Z'))] as V[]
    }))
    insert('dbo.PurchaseGuests', ['PurchaseId', 'UserId'], buys.flatMap(({ b, u }) => u.who.map((g) => [raw(`(SELECT Id FROM dbo.Purchases WHERE PublicId = '${guid(`buy:${b.key}:${u.item}`)}')`), U(g)] as V[])))

    // Check-in, boarding, muster.
    const steps = ['confirm', 'document', 'photo', 'emergency', 'contract', 'health']
    const checkins = live.filter((b) => b.checkin && b.checkin !== 'none')
    const doneAt = Date.parse('2027-03-18T15:00:00Z')
    insert('dbo.CheckinGuests', ['BookingId', 'UserId', 'Step', 'DoneAt', 'Data'], checkins.flatMap((b) => b.guests.flatMap((g) =>
      steps.slice(0, b.checkin === 'half' ? 2 : 6).map((s) => [B(b.key), U(g), s, ts(doneAt), json(s === 'emergency' ? { name: 'Alex Contact', phone: '+1 305 555 0100' } : s === 'health' ? { symptoms: false } : {})] as V[]))))
    insert('dbo.CheckinBooking', ['BookingId', 'PaymentLabel', 'PaymentAt', 'FinishedAt'], checkins.map((b) => [B(b.key), 'Onboard account card', b.checkin === 'done' ? ts(doneAt) : null, b.checkin === 'done' ? ts(doneAt) : null]))
    const boarded = checkins.filter((b) => b.checkin === 'done')
    insert('dbo.BoardingPasses', ['BookingId', 'UserId', 'Seq', 'Code', 'InWallet', 'IssuedAt'], boarded.flatMap((b) => b.guests.map((g, i) => [B(b.key), U(g), i + 1, `PCPASS.${b.number}.${i + 1}.${createHash('sha1').update(`${b.number}${g}`).digest('hex').slice(0, 16)}`, false, ts(doneAt)] as V[])))
    insert('dbo.EmbarkProgress', ['BookingId', 'LuggageStatus', 'LuggageDroppedAt', 'Terminal'], boarded.map((b) => [B(b.key), b.luggage ?? 'notDropped', b.luggage ? ts(stageAtMs('embarkation', 0.5)) : null, 'Terminal 25']))
    insert('dbo.MusterConfirmations', ['BookingId', 'UserId', 'ConfirmedAt', 'ByUserId'], boarded.filter((b) => b.muster).flatMap((b) => b.guests.map((g) => [B(b.key), U(g), ts(stageAtMs('embarkation', 5)), U(b.booker)] as V[])))

    // Folio.
    const folioDefs: [number, string, string, number, string | null][] = [[1, 'Dining', 'Specialty cover charge', 4500, null], [2, 'Bar', 'Drinks at the Piazza Bar', 3150, null], [3, 'Shops', 'Sunscreen and a hat', 2899, null]]
    const folioRows = live.filter((b) => b.folio).flatMap((b) => folioDefs.map(([day, cat, desc, cents, cov], i) => [pub(`folio:${b.key}:${i}`), B(b.key), U(b.booker), day, cat, desc, b.fare === 'standard' || i === 2 ? cents : 0, b.fare !== 'standard' && i < 2 ? 'package' : cov, 'manual', ts(stageAtMs('embarkation', 24 * (day - 1) + 8))] as V[]))
    insert('dbo.FolioLines', ['PublicId', 'BookingId', 'UserId', 'Day', 'Category', 'Description', 'Cents', 'CoveredBy', 'SourceType', 'At'], folioRows)

    // After the cruise.
    const afters = live.filter((b) => b.after)
    insert('dbo.DisembarkChoices', ['BookingId', 'Option', 'TagsOn', 'DecidedAt'], afters.filter((b) => b.after !== 'quiet').map((b) => [B(b.key), b.after === 'walkoff' ? 'earlyWalkOff' : 'tagged', b.after !== 'walkoff', ts(stageAtMs('farewell', 6))]))
    insert('dbo.DisembarkBags', ['BookingId', 'UserId', 'Bags'], afters.filter((b) => b.after === 'billing').flatMap((b) => b.guests.map((g) => [B(b.key), U(g), 2] as V[])))
    insert('dbo.Customs', ['BookingId', 'Declaration', 'SubmittedAt'], afters.filter((b) => b.after === 'billing').map((b) => [B(b.key), json({ goods: false, cash: false, food: false }), ts(stageAtMs('farewell', 8))]))
    insert('dbo.OnwardPlans', ['BookingId', 'Mode', 'FlightAtLocal', 'Flight', 'Note'], afters.filter((b) => b.after === 'billing').map((b) => [B(b.key), 'flight', tm('14:30'), 'UA 482', 'Taxi to the airport.']))
    insert('dbo.FinalBill', ['BookingId', 'TipKeepPercent', 'EmailedAt', 'EmailedTo', 'SettledAt'], afters.filter((b) => b.after !== 'walkoff').map((b) => [B(b.key), 100, ts(stageAtMs('disembark', -4)), emailOf(b.booker), b.after === 'billing' ? ts(stageAtMs('postCruise', 0)) : null]))
    insert('dbo.Cases', ['PublicId', 'UserId', 'BookingId', 'Kind', 'Number', 'Summary', 'Cents', 'LineId', 'Stage', 'OpenedAt', 'DueAt'], afters.filter((b) => b.after === 'billing').map((b) => [
      pub(`case:${b.key}`), U(b.booker), B(b.key), 'billing', 'CASE-100231', 'I was charged twice for the Piazza Bar tab on day 2.', 3150, guid(`folio:${b.key}:1`), 'inReview', ts(stageAtMs('postCruise', 5)), ts(stageAtMs('postCruise', 24 * 7))]))
    insert('dbo.PostFeedback', ['BookingId', 'Json', 'SubmittedAt', 'EditUntil'], afters.filter((b) => b.after === 'billing').map((b) => [B(b.key), json({ overall: 4, ship: 5, dining: 4, comment: 'Lovely trip, one billing error.' }), ts(stageAtMs('postCruise', 6)), ts(stageAtMs('postCruise', 24 * 14))]))
    insert('dbo.RebookHolds', ['PublicId', 'UserId', 'BookingId', 'SailingId', 'CategoryId', 'Guests', 'TotalCents', 'DepositCents', 'Onboard', 'PlacedAt', 'ExpiresAt'], afters.filter((b) => b.after === 'billing').map((b) => {
      const q = bookingQuote('sun-2027-12-26'.replace('12-26', '12-27'), 'balcony', 1, 'plus')?.total ?? bookingQuote(REF.id, 'balcony', 1, 'plus')!.total
      return [pub(`rebook:${b.key}`), U(b.booker), B(b.key), SAILINGS.some((s) => s.id === 'sun-2026-12-27') ? 'sun-2026-12-27' : REF.id, 'balcony', 1, q, Math.round(q * 0.2), false, ts(stageAtMs('postCruise', 1)), ts(stageAtMs('postCruise', 24 * 7))] as V[]
    }))
  })
  return header('journey data: checklists, tours, dining, purchases, check-in, boarding, folio and after the cruise', false) + body + '\n' + footer
}

export const FILE_NAMES = ['00-reset-personas', '01-users', '02-bookings', '03-journey'] as const

export function buildFiles(): Record<string, string> {
  void daysBetween; void sailingLabel; void DAYS
  return { '00-reset-personas': resetFile(), '01-users': usersFile(), '02-bookings': bookingsFile(), '03-journey': journeyFile() }
}

export function runAll(): string {
  return ['/*', '  Runs every persona seed in order, starting with the reset. Use sqlcmd from the repository root:', '      sqlcmd -S <server> -d <database> -b -i db/seed/personas/run-all.sql', '*/', ':on error exit', ...FILE_NAMES.map((f) => `:r db/seed/personas/${f}.sql`), ''].join('\n')
}

export function catalogue(): string {
  const rows = PEOPLE.map((p) => {
    const b = bookingOf(p.slug)
    const login = p.child ? `via ${p.child} (view as)` : `\`${emailOf(p.slug)}\``
    return `| ${p.first} ${p.last} | ${login} | ${b ? `${b.number} (${b.booker === p.slug ? 'booker' : 'guest'})` : 'none'} | ${p.stage} | ${clockOf(p).slice(0, 16).replace('T', ' ')} | ${(p.scenarios ?? []).join(', ') || '-'} | ${p.role}. ${p.test} |`
  })
  return [
    '# Persona catalogue', '', 'GENERATED by `npm run db:persona:gen`. Every person is a demo user (`IsDemo = 1`) with a `Slug`.', '',
    `Shared demo password: \`${DEMO_PASSWORD}\` (hashed per person, PBKDF2-HMAC-SHA512, ${PBKDF2_ITERATIONS.toLocaleString('en-US')} iterations, \`pbkdf2$iter$salt$hash\`). Supervised children have no password.`,
    `Sailing for every booking: \`${REF.id}\` (${DEPARTURE}). Each person's demo clock (\`demo.DemoState\`) is set so that "now" equals the clock column below at the moment the seed runs.`, '',
    '| Person | Login | Booking | Stage | Demo clock (UTC) | Scenarios | What to test |', '| --- | --- | --- | --- | --- | --- | --- |', ...rows, '',
    '## Not seeded', '', 'No table is seeded for: travel-party chat, orders, kids club check-ins, health reports, room settings, photos, laundry, Wi-Fi, budgets, games, TV, parties, medallions, bag tags, upgrade bids, club registrations, waitlists and queues, show tickets. Those start empty for every persona and fill as the API is used. The two agent booking numbers in `src/domain/trip.ts` (`AG4K72Q`, `AG9M18T`) are link fixtures and are deliberately not seeded.', '',
  ].join('\n')
}

export const BOOKING_SUMMARY = BOOKINGS.map((b) => ({ key: b.key, number: b.number, total: totalOf(b), deposit: planOf(b).deposit, due: planOf(b).finalDue, daysOut: daysBetween(dateOnly(stageAtMs('booked')), DEPARTURE) }))
