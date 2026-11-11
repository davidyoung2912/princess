import { describe, expect, it } from 'vitest'
import { GLOSSARY, glossaryByLetter } from './glossary'

describe('nautical glossary', () => {
  it('is extensive, with a definition for every term and no repeats', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(100)
    for (const g of GLOSSARY) expect(g.definition.trim().length, g.term).toBeGreaterThan(10)
    const names = GLOSSARY.map((g) => g.term.toLowerCase())
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([])
  })

  it('is sorted alphabetically', () => {
    const by = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base', ignorePunctuation: true })
    for (let i = 1; i < GLOSSARY.length; i++) expect(by(GLOSSARY[i - 1].term, GLOSSARY[i].term), GLOSSARY[i].term).toBeLessThanOrEqual(0)
    expect(GLOSSARY[0].term[0]).toBe('A')
  })

  it('groups the terms under their first letter, in order', () => {
    const groups = glossaryByLetter()
    const letters = groups.map((g) => g.letter)
    expect(letters).toEqual([...letters].sort())
    expect(groups.flatMap((g) => g.terms)).toEqual([...GLOSSARY])
  })
})
