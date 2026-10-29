/** The documents engine for closed-loop Caribbean cruises (MNG-05, MNG-11). Rules are authored mock content (verify before real use). */
export type DocId = 'passport' | 'birthCertificate' | 'photoId' | 'insurance'
export type Citizenship = 'us' | 'other'
export type RequirementId = 'proofOfCitizenship' | 'photoId' | 'passport' | 'insurance'
export type Level = 'required' | 'recommended' | 'optional'

export const DOCS: Record<DocId, { name: string; hasExpiry: boolean }> = {
  passport: { name: 'Passport', hasExpiry: true },
  birthCertificate: { name: 'Birth certificate (certified copy)', hasExpiry: false },
  photoId: { name: 'Government photo ID', hasExpiry: true },
  insurance: { name: 'Travel insurance', hasExpiry: true },
}
export const DOC_IDS = Object.keys(DOCS) as DocId[]

export const ADULT_AGE = 16
export const PASSPORT_VALID_MONTHS = 6

export interface Requirement {
  id: RequirementId
  level: Level
  /** Any one of these documents meets the requirement. */
  satisfiedBy: readonly DocId[]
}

/** What a guest needs, by citizenship and age. */
export function requirementsFor(citizenship: Citizenship, age: number): Requirement[] {
  const insurance: Requirement = { id: 'insurance', level: 'optional', satisfiedBy: ['insurance'] }
  if (citizenship === 'other') return [{ id: 'passport', level: 'required', satisfiedBy: ['passport'] }, insurance]
  const list: Requirement[] = [{ id: 'proofOfCitizenship', level: 'required', satisfiedBy: ['passport', 'birthCertificate'] }]
  if (age >= ADULT_AGE) list.push({ id: 'photoId', level: 'required', satisfiedBy: ['passport', 'photoId'] })
  list.push({ id: 'passport', level: 'recommended', satisfiedBy: ['passport'] }, insurance)
  return list
}

/** What the guest says they hold, with an expiry date ("YYYY-MM-DD") where the document has one. */
export type Held = Partial<Record<DocId, { expires?: string }>>

const addMonths = (date: string, months: number): string => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

/** The last day a passport can expire and still count: six months after the return date. */
export const passportValidUntil = (returnDate: string): string => addMonths(returnDate, PASSPORT_VALID_MONTHS)

export type DocStatus = 'ok' | 'tooSoon' | 'expired' | 'noExpiry'

/** A passport must be valid for six months past the return date; other dated documents only until the return. */
export function docStatus(doc: DocId, held: Held, returnDate: string): DocStatus | 'missing' {
  const h = held[doc]
  if (!h) return 'missing'
  if (!DOCS[doc].hasExpiry) return 'ok'
  if (!h.expires) return 'noExpiry'
  if (h.expires < returnDate) return 'expired'
  if (doc === 'passport' && h.expires < addMonths(returnDate, PASSPORT_VALID_MONTHS)) return 'tooSoon'
  return 'ok'
}

export type ReqStatus = 'ready' | 'missing' | 'problem'
export interface ReqResult { requirement: Requirement; status: ReqStatus; usedDoc?: DocId; problem?: DocStatus }

/** A requirement is ready when any accepted document is held and in date; a held document with a date problem is a problem, not missing. */
export function checkRequirement(r: Requirement, held: Held, returnDate: string): ReqResult {
  const results = r.satisfiedBy.map((doc) => ({ doc, status: docStatus(doc, held, returnDate) }))
  const good = results.find((x) => x.status === 'ok')
  if (good) return { requirement: r, status: 'ready', usedDoc: good.doc }
  const bad = results.find((x) => x.status !== 'missing' && x.status !== 'noExpiry')
  if (bad) return { requirement: r, status: 'problem', usedDoc: bad.doc, problem: bad.status as DocStatus }
  const undated = results.find((x) => x.status === 'noExpiry')
  if (undated) return { requirement: r, status: 'problem', usedDoc: undated.doc, problem: 'noExpiry' }
  return { requirement: r, status: 'missing' }
}

export interface GuestDocs {
  results: ReqResult[]
  /** Required items that are not ready. */
  blocking: number
  ready: boolean
}

export function guestDocuments(citizenship: Citizenship, age: number, held: Held, returnDate: string): GuestDocs {
  const results = requirementsFor(citizenship, age).map((r) => checkRequirement(r, held, returnDate))
  const blocking = results.filter((x) => x.requirement.level === 'required' && x.status !== 'ready').length
  return { results, blocking, ready: blocking === 0 }
}

/** What each demo person is already known to hold, so the wallet starts realistic. Gerald's passport is deliberately close to expiry. */
export const DEFAULT_HELD: Record<string, Held> = {
  gerald: { passport: { expires: '2027-08-14' }, photoId: { expires: '2029-04-30' } },
  maria: {},
  linda: { passport: { expires: '2031-05-01' } },
  alexander: { passport: { expires: '2031-11-20' }, insurance: { expires: '2027-04-30' } },
  daniel: { passport: { expires: '2030-02-01' } },
  priya: { passport: { expires: '2030-02-01' } },
  ethan: { passport: { expires: '2029-06-01' } },
  maya: { birthCertificate: {} },
  marcus: { birthCertificate: {}, photoId: { expires: '2028-09-12' } },
  elena: { birthCertificate: {}, photoId: { expires: '2030-01-05' } },
  lucas: { birthCertificate: {} },
  sofia: { birthCertificate: {} },
}

/** Held documents from untrusted data. */
export function normalizeHeld(raw: unknown): Held {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const held: Held = {}
  for (const id of DOC_IDS) {
    const v = o[id]
    if (!v || typeof v !== 'object') continue
    const e = (v as { expires?: unknown }).expires
    held[id] = DOCS[id].hasExpiry && typeof e === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e) ? { expires: e } : {}
  }
  return held
}

/** Entry notes for the countries on this cruise. Authored; rules change, so each is marked to verify. */
export const PORT_ENTRY: readonly { country: string; note: string }[] = [
  { country: 'Mexico (Cozumel)', note: 'A passport is the safest document. Closed-loop cruise passengers who are US citizens may use a birth certificate and photo ID. Verify before travel.' },
  { country: 'Belize (Belize City)', note: 'Cruise passengers go ashore by tender. A passport is recommended. Verify before travel.' },
  { country: 'Honduras (Roatán)', note: 'A passport is recommended. Some visitors pay a small port or tourism fee. Verify before travel.' },
]
