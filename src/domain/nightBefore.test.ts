import { describe, expect, it } from 'vitest'
import { buildCapsule } from './offlineCapsule'
import { batteryIsLow, nightBeforeTest, refreshFactor, type ReadinessFacts } from './nightBefore'

const NOW = Date.UTC(2026, 10, 8, 12)
const key = (kind: string) => `princess:cache:${kind}:x`
const entry = (kind: string, savedAt: number) => ({ key: key(kind), bytes: 100, savedAt })
const full = buildCapsule([entry('pass', NOW), entry('muster', NOW), entry('emergency', NOW)], NOW)
const facts = (o: Partial<ReadinessFacts> = {}): ReadinessFacts => ({ capsule: full, storage: 'protected', notifications: 'granted', battery: { level: 0.9, charging: false }, ...o })
const result = (r: ReturnType<typeof nightBeforeTest>, id: string) => r.checks.find((c) => c.id === id)?.result

describe('nightBeforeTest', () => {
  it('passes when everything is in order', () => {
    expect(nightBeforeTest(facts()).result).toBe('pass')
  })
  it('fails with nothing saved', () => {
    const r = nightBeforeTest(facts({ capsule: buildCapsule([], NOW) }))
    expect(result(r, 'essentials')).toBe('fail')
    expect(r.result).toBe('fail')
  })
  it('warns when one essential is missing', () => {
    const r = nightBeforeTest(facts({ capsule: buildCapsule([entry('pass', NOW), entry('muster', NOW)], NOW) }))
    expect(result(r, 'essentials')).toBe('warn')
    expect(r.result).toBe('warn')
  })
  it('fails when storage is nearly full and warns when unprotected', () => {
    expect(result(nightBeforeTest(facts({ storage: 'low' })), 'storage')).toBe('fail')
    expect(result(nightBeforeTest(facts({ storage: 'unprotected' })), 'storage')).toBe('warn')
  })
  it('warns when notifications are off or missing', () => {
    expect(result(nightBeforeTest(facts({ notifications: 'denied' })), 'notifications')).toBe('warn')
    expect(result(nightBeforeTest(facts({ notifications: null })), 'notifications')).toBe('warn')
  })
  it('warns on a low battery that is not charging', () => {
    expect(result(nightBeforeTest(facts({ battery: { level: 0.1, charging: false } })), 'battery')).toBe('warn')
    expect(result(nightBeforeTest(facts({ battery: { level: 0.1, charging: true } })), 'battery')).toBe('pass')
    expect(result(nightBeforeTest(facts({ battery: null })), 'battery')).toBe('pass')
  })
})

describe('refreshFactor', () => {
  it('is 1 normally, 4 data-light, 2 on a low battery, 8 for both', () => {
    expect(refreshFactor({ dataLight: false, battery: null })).toBe(1)
    expect(refreshFactor({ dataLight: true, battery: null })).toBe(4)
    expect(refreshFactor({ dataLight: false, battery: { level: 0.15, charging: false } })).toBe(2)
    expect(refreshFactor({ dataLight: true, battery: { level: 0.15, charging: false } })).toBe(8)
  })
  it('ignores a low battery while charging', () => {
    expect(batteryIsLow({ level: 0.05, charging: true })).toBe(false)
  })
})
