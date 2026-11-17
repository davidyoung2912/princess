import { describe, expect, it } from 'vitest'
import { cardFields, cardReady, daysUntil, huddleLink, huddleProblem, mayJoin, tokenFromHash } from './chatHuddle'

describe('the huddle link', () => {
  it('keeps the token after the hash, so it is not sent to a server', () => {
    const url = huddleLink('https://example.test', 'abcdefghijklmnopqrstuvwxyz0123456789-_AB')
    expect(url).toBe('https://example.test/chat#huddle=abcdefghijklmnopqrstuvwxyz0123456789-_AB')
    expect(new URL(url).search).toBe('')
  })
  it('reads a token back and refuses anything that is not one', () => {
    const token = 'abcdefghijklmnopqrstuvwxyz0123456789-_AB'
    expect(tokenFromHash(`#huddle=${token}`)).toBe(token)
    expect(tokenFromHash('')).toBeNull()
    expect(tokenFromHash('#huddle=short')).toBeNull()
    expect(tokenFromHash('#huddle=<script>alert(1)</script>aaaaaaaaaaaa')).toBeNull()
    expect(tokenFromHash(`#other=${token}`)).toBeNull()
    expect(tokenFromHash(`#huddle=${'a'.repeat(101)}`)).toBeNull()
  })
})

describe('shortlist cards', () => {
  it('drops empty rows, trims, and keeps the last of a repeated label', () => {
    expect(cardFields([{ label: ' Ship ', value: ' Sun Princess ' }, { label: '', value: 'x' }, { label: 'Nights', value: '' }, { label: 'Ship', value: 'Star Princess' }])).toEqual({ Ship: 'Star Princess' })
  })
  it('keeps at most twelve labels and cuts a long value', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ label: `L${i}`, value: 'v' }))
    expect(Object.keys(cardFields(rows))).toHaveLength(12)
    expect(cardFields([{ label: 'a', value: 'x'.repeat(500) }]).a).toHaveLength(140)
  })
  it('is ready with a known kind and a title that is not blank or too long', () => {
    expect(cardReady('sailing', 'Alaska, 7 nights')).toBe(true)
    expect(cardReady('photo', 'x')).toBe(false)
    expect(cardReady('port', '   ')).toBe(false)
    expect(cardReady('port', 'x'.repeat(121))).toBe(false)
  })
})

describe('joining', () => {
  it('needs the adult statement and a seat', () => {
    expect(mayJoin(true, 1)).toBe(true)
    expect(mayJoin(false, 3)).toBe(false)
    expect(mayJoin(true, 0)).toBe(false)
  })
})

describe('what the server said', () => {
  it('names the refusals it has a sentence for', () => {
    expect(huddleProblem('forbidden', 'underage')).toBe('underage')
    expect(huddleProblem('notFound', 'invalidLink')).toBe('invalidLink')
    expect(huddleProblem('invalid', 'card')).toBe('card')
    expect(huddleProblem('offline', undefined)).toBe('offline')
    expect(huddleProblem('server', 'something else')).toBe('other')
  })
})

describe('the deletion date', () => {
  it('counts whole days and never goes below zero', () => {
    expect(daysUntil(3 * 86_400_000 + 1, 0)).toBe(4)
    expect(daysUntil(0, 5)).toBe(0)
  })
})
