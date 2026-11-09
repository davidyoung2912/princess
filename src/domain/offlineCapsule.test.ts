import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { maxAgeFor } from './offlineCache'
import { buildCapsule, CAPSULE_KINDS, formatBytes, kindOfKey, readCapsuleEntries, storageState } from './offlineCapsule'

const DAY = 86_400_000
const NOW = Date.UTC(2027, 0, 10, 12)
const entry = (kind: string, id: string, savedAt: number | null, bytes = 100) => ({ key: `princess:cache:${kind}:${id}`, bytes, savedAt })

describe('offline capsule (MOB-03, QOL-04)', () => {
  it('has words for every kind it can show', () => {
    for (const d of CAPSULE_KINDS) expect((en as Record<string, string>)[`capsule.kind.${d.kind}`], d.kind).toBeTruthy()
  })

  it('reads the kind out of a cache key and ignores other keys', () => {
    expect(kindOfKey('princess:cache:pass:abc')).toBe('pass')
    expect(kindOfKey('princess:cache:feed-weather:x:y')).toBe('feed-weather')
    expect(kindOfKey('princess:settings')).toBeNull()
    expect(kindOfKey('princess:cache:')).toBeNull()
  })

  it('is empty, with every essential missing, when nothing is kept', () => {
    const c = buildCapsule([], NOW)
    expect(c.readiness).toBe('empty')
    expect(c.missing.map((m) => m.kind)).toEqual(['pass', 'muster', 'emergency'])
    expect(c.earliestExpiry).toBeNull()
  })

  it('is partial until all three essentials are kept, then ready', () => {
    const two = buildCapsule([entry('pass', 'a', NOW - DAY), entry('muster', 'a', NOW - DAY)], NOW)
    expect(two.readiness).toBe('partial')
    expect(two.missing.map((m) => m.kind)).toEqual(['emergency'])
    const three = buildCapsule([entry('pass', 'a', NOW - DAY), entry('muster', 'a', NOW - DAY), entry('emergency', 'a', NOW - DAY)], NOW)
    expect(three.readiness).toBe('ready')
    expect(three.missing).toEqual([])
  })

  it('treats an expired essential as missing, and says so rather than counting it', () => {
    const old = NOW - maxAgeFor('pass') - DAY
    const c = buildCapsule([entry('pass', 'a', old), entry('muster', 'a', NOW), entry('emergency', 'a', NOW)], NOW)
    expect(c.rows.find((r) => r.kind === 'pass')?.state).toBe('expired')
    expect(c.missing.map((m) => m.kind)).toEqual(['pass'])
    expect(c.readiness).toBe('partial')
  })

  it('marks a copy ageing once past half its limit, and gives the moment it stops being used', () => {
    const saved = NOW - maxAgeFor('pass') * 0.6
    const row = buildCapsule([entry('pass', 'a', saved)], NOW).rows[0]
    expect(row.state).toBe('ageing')
    expect(row.expiresAt).toBe(saved + maxAgeFor('pass'))
  })

  it('uses the newest copy of a kind for its age and adds up the sizes and copies', () => {
    const c = buildCapsule([entry('program', 'a:1', NOW - 2 * DAY, 300), entry('program', 'a:2', NOW - DAY, 200)], NOW)
    const row = c.rows[0]
    expect(row).toMatchObject({ kind: 'program', copies: 2, bytes: 500, savedAt: NOW - DAY })
  })

  it('counts unreadable copies and still counts their size, without making rows of them', () => {
    const c = buildCapsule([entry('pass', 'a', null, 50), entry('feed-weather', 'x', NOW, 70)], NOW)
    expect(c.unreadable).toBe(1)
    expect(c.rows).toEqual([])
    expect(c.totalBytes).toBe(120)
  })

  it('reads entries from a storage, flagging text it cannot parse and skipping other keys', () => {
    const data: Record<string, string> = {
      'princess:cache:pass:a': JSON.stringify({ savedAt: 5, value: { x: 1 } }),
      'princess:cache:muster:a': 'not json',
      'princess:cache:room:a': JSON.stringify({ savedAt: 'soon', value: 1 }),
      'princess:settings': '{}',
    }
    const keys = Object.keys(data)
    const storage = { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => data[k] ?? null }
    const entries = readCapsuleEntries(storage)
    expect(entries.map((e) => [e.key, e.savedAt])).toEqual([['princess:cache:pass:a', 5], ['princess:cache:muster:a', null], ['princess:cache:room:a', null]])
    expect(readCapsuleEntries(null)).toEqual([])
    expect(readCapsuleEntries({ length: 1, key: () => { throw new Error('denied') }, getItem: () => null })).toEqual([])
  })

  it('formats sizes', () => {
    expect(formatBytes(312)).toBe('312 B')
    expect(formatBytes(48 * 1024)).toBe('48 KB')
    expect(formatBytes(1.2 * 1024 * 1024)).toBe('1.2 MB')
  })

  it('reports whether the browser will keep the copies, and warns first when space is nearly gone', () => {
    expect(storageState({ usage: 1, quota: 100, persisted: true })).toBe('protected')
    expect(storageState({ usage: 1, quota: 100, persisted: false })).toBe('unprotected')
    expect(storageState({ usage: null, quota: null, persisted: null })).toBe('unknown')
    expect(storageState({ usage: 90, quota: 100, persisted: true })).toBe('low')
  })
})
