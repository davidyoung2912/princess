import { describe, expect, it } from 'vitest'
import { forRule, normalizeValue } from './stanleyValue'

const finding = (id: string, rule: string, route = '/me/bill') => ({ id, rule, consequence: 'conflict', title: id, detail: 'd', day: null, due: null, fix: { label: 'Open', route } })

describe('normalizeValue', () => {
  it('rejects a wrong shape', () => {
    expect(normalizeValue(null)).toBeNull()
    expect(normalizeValue({ findings: [] })).toBeNull()
  })

  it('keeps the server order and drops a finding whose fix leaves the app', () => {
    const v = normalizeValue({ hasTrip: true, findings: [finding('a', 'CHK-04'), finding('b', 'VAL-01', 'https://evil.example/x'), finding('c', 'CHK-05', '/plan/packing')], notChecked: ['x', 3], clean: false, asOf: '2027-03-22T10:00:00Z' })
    expect(v?.findings.map((f) => f.id)).toEqual(['a', 'c'])
    expect(v?.notChecked).toEqual(['x'])
  })

  it('is never clean while it holds a finding', () => {
    expect(normalizeValue({ hasTrip: true, findings: [finding('a', 'CHK-04')], notChecked: [], clean: true })?.clean).toBe(false)
  })

  it('groups by rule', () => {
    const v = normalizeValue({ hasTrip: true, findings: [finding('a', 'CHK-04'), finding('b', 'VAL-01'), finding('c', 'CHK-04')], notChecked: [], clean: false })!
    expect(forRule(v.findings, 'CHK-04').map((f) => f.id)).toEqual(['a', 'c'])
    expect(forRule(v.findings, 'CHK-05')).toEqual([])
  })
})
