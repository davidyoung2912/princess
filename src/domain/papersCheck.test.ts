import { describe, expect, it } from 'vitest'
import { compareNames, fixes, papersCheck, type PapersInput } from './papersCheck'

const base: PapersInput = { bookedName: 'Gerald Whitfield', passportName: '', age: 70, citizenship: 'us', held: {}, returnDate: '2027-03-28', withParents: 'both' }
const ids = (i: Partial<PapersInput>) => papersCheck({ ...base, ...i }).map((c) => c.id)

describe('name match (S3-02)', () => {
  it('ignores case, accents, hyphens and spacing', () => {
    expect(compareNames('Gerald Whitfield', '  GERALD   whitfield ')).toBe('match')
    expect(compareNames('José Núñez', 'Jose Nunez')).toBe('match')
    expect(compareNames('Anne-Marie Cole', 'Anne Marie Cole')).toBe('match')
  })
  it('tells a middle name or swapped order from a real difference', () => {
    expect(compareNames('Gerald Whitfield', 'Gerald Arthur Whitfield')).toBe('middle')
    expect(compareNames('Gerald Whitfield', 'Whitfield Gerald')).toBe('order')
    expect(compareNames('Gerald Whitfield', 'Gerald Whitfeld')).toBe('typo')
    expect(compareNames('Gerald Whitfield', 'Gerry Smith')).toBe('different')
    expect(compareNames('Gerald Whitfield', '')).toBe('empty')
  })
})

describe('document checks (S3-02)', () => {
  it('asks for a fix when the name differs, with the fix-it path', () => {
    const c = papersCheck({ ...base, passportName: 'Gerald Whitfeld', held: { passport: { expires: '2031-01-01' } } })
    expect(c.find((x) => x.id === 'name.typo')).toMatchObject({ level: 'fix', link: '/me/fix-it' })
  })
  it('flags a passport too close to expiry and one that is fine', () => {
    expect(ids({ held: { passport: { expires: '2027-06-01' } } })).toContain('passport.tooSoon')
    expect(ids({ held: { passport: { expires: '2027-01-01' } } })).toContain('passport.expired')
    expect(ids({ held: { passport: { expires: '2031-01-01' } } })).toContain('passport.ok')
  })
  it('checks the birth certificate and photo ID combination for a US adult', () => {
    expect(ids({ held: { birthCertificate: {} } })).toContain('combo.needPhoto')
    expect(ids({ held: { photoId: { expires: '2030-01-01' } } })).toContain('combo.needProof')
    expect(ids({ held: {} })).toContain('combo.none')
    expect(ids({ held: { birthCertificate: {}, photoId: { expires: '2030-01-01' } } })).toEqual(expect.arrayContaining(['combo.ok', 'combo.certified']))
  })
  it('lets a child go on a birth certificate alone, and asks an overseas guest for a passport', () => {
    expect(ids({ age: 9, held: { birthCertificate: {} } })).toContain('combo.childOk')
    expect(ids({ age: 9, held: {} })).toContain('combo.childNeedsProof')
    expect(ids({ citizenship: 'other', held: {} })).toContain('passport.missing')
  })
  it('asks for consent letters only for a minor without both parents', () => {
    expect(ids({ age: 12, withParents: 'one' })).toContain('consent.one')
    expect(ids({ age: 12, withParents: 'neither' })).toContain('consent.neither')
    expect(ids({ age: 12, withParents: 'both' }).some((x) => x.startsWith('consent'))).toBe(false)
    expect(ids({ age: 30, withParents: 'neither' }).some((x) => x.startsWith('consent'))).toBe(false)
  })
  it('lists only the fixes', () => {
    expect(fixes(papersCheck({ ...base, held: {} })).every((c) => c.level === 'fix')).toBe(true)
  })
})
