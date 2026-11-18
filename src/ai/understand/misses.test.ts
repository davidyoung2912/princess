import { describe, expect, it } from 'vitest'
import { analyseMisses, reportText } from './misses'

describe('reading an export of unanswered questions', () => {
  it('counts repeats, sorts the misses and says what is placed now', () => {
    const r = analyseMisses(['zxqv blorptastic', 'zxqv blorptastic', 'flarbnoodle wibble', 'where is the spa'])
    expect(r.total).toBe(4)
    expect(r.misses[0]).toEqual({ text: 'zxqv blorptastic', count: 2 })
    expect(r.nowAnswered.map((m) => m.text)).toContain('where is the spa')
    expect(r.unknownWords.map((w) => w.word)).toContain('blorptastic')
  })
  it('prints a readable report and survives nothing and junk', () => {
    expect(reportText(analyseMisses([]))).toContain('Questions read: 0')
    expect(() => analyseMisses(['', '   ', '\u0000‮', 'x'.repeat(5000)])).not.toThrow()
    expect(reportText(analyseMisses(['zxqv blorptastic']))).toContain('1 x zxqv blorptastic')
  })
})
