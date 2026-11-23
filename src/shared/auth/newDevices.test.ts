import { describe, expect, it } from 'vitest'
import { newDevices } from './newDevices'
import type { DeviceSession } from './provider'

const d = (id: string, current = false): DeviceSession => ({ id, device: id, signedInAt: 1, lastActiveAt: 1, current })

describe('new sign-in notice (SEC-07)', () => {
  it('says nothing the first time, because there is no baseline', () => {
    expect(newDevices([d('a', true), d('b')], null)).toEqual([])
  })
  it('flags other devices not yet shown, never this one', () => {
    expect(newDevices([d('a', true), d('b'), d('c')], ['b']).map((x) => x.id)).toEqual(['c'])
    expect(newDevices([d('a', true)], [])).toEqual([])
  })
})
