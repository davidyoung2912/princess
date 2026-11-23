import { describe, expect, it } from 'vitest'
import { directPath, handoffPath, lifeWords, parseSharePath, qrKindOf, receiveProblem, shareUrl, splitRef } from './shareCodes'
import { readCode } from './scanCode'

describe('share codes', () => {
  it('splits a ref at its first colon', () => {
    expect(splitRef('venue:crown-grill')).toEqual({ type: 'venue', ref: 'crown-grill' })
    expect(splitRef('menu:crown-grill:dinner')).toEqual({ type: 'menu', ref: 'crown-grill:dinner' })
    for (const bad of ['', 'venue', 'venue:', ':x']) expect(splitRef(bad)).toBeNull()
  })

  it('makes a venue and a menu direct codes and knows no other type', () => {
    expect(qrKindOf('venue:crown-grill')).toBe('direct')
    expect(qrKindOf('menu:crown-grill:dinner')).toBe('direct')
    expect(qrKindOf('excursion:abc')).toBeNull()
    expect(qrKindOf('nonsense')).toBeNull()
  })

  it('writes a direct address that the scanner reads back as the same thing', () => {
    for (const ref of ['venue:crown-grill', 'menu:crown-grill:dinner']) {
      const path = directPath(ref)!
      const url = shareUrl('https://app.example', path)
      const found = readCode(url, 'https://app.example')
      expect(found.kind).toBe('share')
      const target = parseSharePath(found.kind === 'share' ? found.path : '')
      expect(target).toEqual({ kind: 'direct', ...splitRef(ref)! })
    }
  })

  it('reads a handoff address and refuses anything else', () => {
    expect(parseSharePath(handoffPath('abcd2345efgh6789'))).toEqual({ kind: 'code', code: 'abcd2345efgh6789' })
    for (const bad of ['/s', '/s?t=venue', '/s/ab', '/s/abcd1234?x=1', '/other', '/s/a b c d']) expect(parseSharePath(bad)).toBeNull()
  })

  it('says one thing for a stopped code and another for a ref the sailing lacks', () => {
    expect(receiveProblem({ code: 'notFound' })).toBe('stopped')
    expect(receiveProblem({ code: 'invalid' })).toBe('notOnSailing')
    expect(receiveProblem({ code: 'network' })).toBe('failed')
    expect(receiveProblem(null)).toBe('failed')
  })

  it('names the three lives', () => {
    expect([15, 60, 1440].map(lifeWords)).toEqual(['share.life.15', 'share.life.60', 'share.life.1440'])
  })
})
