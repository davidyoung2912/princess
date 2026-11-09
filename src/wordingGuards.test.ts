import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from './i18n/locales/en'

/**
 * Wording guards (BM17, layer L3 of docs/best-in-market-plan-2.md). Some acceptance clauses are sentences the guest must be able to read, and no
 * behaviour test sees them go missing. Each guard names the clause it proves in a `proves:` comment (read by traceability.test.ts).
 *
 * Known gaps are written as `it.fails`: they pass while the sentence or state is missing and fail the moment it is added, which is the cue to change
 * `it.fails` to `it` (see docs/requirements-verdicts.tsv, which says which rows are gaps).
 */
const strings = Object.entries(en) as [string, string][]
const say = (re: RegExp): boolean => strings.some(([, v]) => typeof v === 'string' && re.test(v))
const read = (p: string): string => readFileSync(p, 'utf8')
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (/^(bin|obj)$/.test(e.name) ? [] : walk(join(dir, e.name))) : /\.cs$/.test(e.name) ? [join(dir, e.name)] : []))

describe('wording the guest must be able to read: present today', () => {
  // proves: DEB-08#2
  it('customs guidance says it is general guidance, not legal advice', () => {
    expect(en['clr.checkBody']).toMatch(/not legal advice/i)
  })

  // proves: OFF-03#2
  it('a saved copy says it can be out of date and sends the guest to the crew or an official notice', () => {
    expect(en['capsule.crew']).toMatch(/out of date/i)
    expect(en['capsule.crew']).toMatch(/crew/i)
  })
})

describe('wording closed in BM18', () => {
  // proves: POR-04#1
  it('POR-04: a port-day tour is labelled as a Princess excursion, apart from independent tours', () => {
    expect(en['port.tourOperated']).toMatch(/Princess excursion/)
    expect(en['port.tourOperated']).toMatch(/independent/)
  })
})

describe('known gaps (it.fails: a pass here means the gap is closed, so turn it into it)', () => {
  // proves: EMB-02#1
  it('EMB-02: says crew instructions and announcements override the app', () => {
    expect(say(/crew (instructions|announcements).*(override|take priority|come first|come before)/i)).toBe(true)
  })

  // proves: MOB-14#1
  it('MOB-14: tells the guest when the time zone or date line changes', () => {
    // (the 'tip.' advice is general guidance, not a notice that the zone changed)
    expect(strings.some(([k, v]) => !k.startsWith('tip.') && /(time ?zone|date line).*(changed|change|crossed)/i.test(v))).toBe(true)
  })

  // proves: DEB-02#2
  it('DEB-02: separates the departure preference from the assignment made by operations', () => {
    expect(say(/(preference|request).*(not|isn.t).*(guarantee|final|assigned)|assigned (by|to).*(ship|operations|crew)/i)).toBe(true)
  })

  // proves: DEB-05#1
  it('DEB-05: says that opening a case does not mean the charge is reversed', () => {
    expect(say(/(opening|sending|submitting) (a|the) (case|request).*(not|n.t).*(reverse|refund)/i)).toBe(true)
  })

  // proves: PRE-18#1
  it('PRE-18: labels refund timing as an estimate', () => {
    expect(en['hub.portSkipped.comp.arrives']).toMatch(/estimate|expect|usually|about|typically/i)
  })

  // proves: EMB-01#1
  it.fails('EMB-01: the boarded state records who set it (manifest or authorised scan), not only a time the guest types', () => {
    expect(read('src/domain/embark.ts')).toMatch(/boardedSource|boardedBy|manifest/i)
  })

  // proves: DEB-04#1
  it.fails('DEB-04: a folio line can be pending, disputed, refunded or adjusted', () => {
    expect(read('src/domain/folio.ts')).toMatch(/disputed|refunded|adjusted/i)
  })

  // proves: BOK-05#1
  it.fails('BOK-05: the server stores the fare and terms version the guest accepted at checkout', () => {
    const server = walk('server/Princess.Api').map(read).join('\n')
    expect(server).toMatch(/FareVersion|TermsVersion|AcceptedFare/i)
  })

  // proves: MNG-05#1
  it('MNG-05: push previews have a rule that keeps sensitive details out of the title and body', () => {
    const server = walk('server/Princess.Api').map(read).join('\n')
    expect(server).toMatch(/Redact|PreviewSafe|SensitivePreview/i)
  })
})
