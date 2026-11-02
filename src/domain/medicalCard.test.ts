import { describe, expect, it } from 'vitest'
import { addMedicalLine, EMPTY_MEDICAL, MEDICAL_LINE_MAX, MEDICAL_LINES_MAX, medicalIsEmpty, medicalText, normalizeMedical, removeMedicalLine } from './medicalCard'

describe('medical readiness card', () => {
  it('cleans lines, drops blanks and repeats, and caps each section', () => {
    const m = normalizeMedical({ medicines: ['  Metformin   500 mg ', 'metformin 500 mg', '', 7, 'x'.repeat(300), ...Array.from({ length: 30 }, (_, i) => `m${i}`)], allergies: 'no', extra: ['x'] })
    expect(m.medicines[0]).toBe('Metformin 500 mg')
    expect(m.medicines[1]).toHaveLength(MEDICAL_LINE_MAX)
    expect(m.medicines).toHaveLength(MEDICAL_LINES_MAX)
    expect(m.allergies).toEqual([])
    expect(Object.keys(m).sort()).toEqual(['allergies', 'conditions', 'devices', 'medicines', 'vaccines'])
    expect(normalizeMedical(null)).toEqual(EMPTY_MEDICAL)
  })

  it('adds and removes lines without changing the card for blanks, repeats or a full section', () => {
    const a = addMedicalLine(EMPTY_MEDICAL, 'allergies', ' Penicillin ')
    expect(a.allergies).toEqual(['Penicillin'])
    expect(addMedicalLine(a, 'allergies', 'penicillin')).toBe(a)
    expect(addMedicalLine(a, 'allergies', '   ')).toBe(a)
    expect(removeMedicalLine(a, 'allergies', 0)).toEqual(EMPTY_MEDICAL)
    expect(medicalIsEmpty(EMPTY_MEDICAL)).toBe(true)
    expect(medicalIsEmpty(a)).toBe(false)
  })

  it('writes text where an empty section says so rather than staying blank', () => {
    const text = medicalText('Card', 'Ana', addMedicalLine(EMPTY_MEDICAL, 'devices', 'CPAP, 12V'), (s) => s, 'Nothing listed')
    expect(text).toMatch(/DEVICES\n- CPAP, 12V/)
    expect(text).toMatch(/ALLERGIES\nNothing listed/)
  })
})
