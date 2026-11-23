import { describe, expect, it } from 'vitest'
import { readCode } from './scanCode'

const o = 'https://app.test'

describe('hand-over codes', () => {
  it('reads a handoff code and a direct code of this app', () => {
    expect(readCode('https://app.test/s/Ab3_x-9Q', o)).toEqual({ kind: 'share', path: '/s/Ab3_x-9Q' })
    expect(readCode('https://app.test/s?t=venue&r=venue:sabatini', o)).toEqual({ kind: 'share', path: '/s?t=venue&r=venue%3Asabatini' })
  })
  it('never follows another origin, and reads odd forms as ordinary links', () => {
    expect(readCode('https://evil.test/s/Ab3_x-9Q', o)).toMatchObject({ kind: 'text' })
    expect(readCode('https://app.test/s/ab', o)).toEqual({ kind: 'link', path: '/s/ab' })
    expect(readCode('https://app.test/s/Ab3_x-9Q?next=http://evil.test', o)).toEqual({ kind: 'link', path: '/s/Ab3_x-9Q' })
    expect(readCode('https://app.test/s?t=venue', o)).toEqual({ kind: 'link', path: '/s' })
    expect(readCode('https://app.test/s?t=venue&r=a&x=1', o)).toEqual({ kind: 'link', path: '/s' })
    expect(readCode('https://app.test/s?t=ve nue&r=<script>', o)).toEqual({ kind: 'link', path: '/s' })
  })
  it('keeps the older place and link codes working', () => {
    expect(readCode('place:piazza', o)).toMatchObject({ kind: 'place' })
    expect(readCode('https://app.test/ship/map', o)).toEqual({ kind: 'link', path: '/ship/map' })
  })
})
