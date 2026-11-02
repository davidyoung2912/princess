import { describe, expect, it } from 'vitest'
import { EMPTY_OFFER_STATE } from '../domain/offers'
import { getOfferState, updateOfferState } from '../offers/store'
import { applyRemoteMemory, EMPTY_MEMORY, getMemory, updateMemory } from '../memory/store'
import { getPhone, updatePhone } from '../phone/store'
import { DEFAULT_TEXT_SIZE } from '../design/textSize'
import { getSettings, switchSettingsOwner, updateSettings } from '../settings/store'
import { getExtras } from '../shop/store'
import { updateHub } from '../hub/store'
import { updateTrip } from '../journey/store'
import { updatePilot } from '../pilot/store'
import { getPort } from '../port/store'
import { EMPTY_PARTY } from '../domain/party'
import { getParty, updateParty } from '../party/store'
import { registerSyncBindings } from './bindings'
import { setKeepPrivate } from './consent'
import { setRemote, sync } from './index'
import type { Remote, RemoteDoc } from './sync'

// The settings store writes to <html> as it changes; node has no page, so give it a stub.
Object.assign(globalThis, { document: { documentElement: { setAttribute: () => {} }, querySelector: () => null } })

const docs = new Map<string, RemoteDoc>()
const remote: Remote = {
  get: async (key) => docs.get(key) ?? null,
  put: async (key, data, base) => {
    const cur = docs.get(key)?.version ?? 0
    if (cur !== base) throw new Error('stale')
    const doc = { version: cur + 1, data }
    docs.set(key, doc)
    return doc
  },
  remove: async (key) => { docs.delete(key) },
}

describe('the real stores through the sync module', () => {
  it('a change on one device reaches the server and a second device', async () => {
    registerSyncBindings()
    setRemote(remote)
    switchSettingsOwner({ id: 'maria', defaultTextSize: DEFAULT_TEXT_SIZE } as never)
    sync.setOwner('user-1', 'maria')
    await sync.pull()

    updatePhone('maria', () => ['wifi' as never])
    updateSettings({ calm: true, theme: 'dark' })
    await sync.flush()
    expect(docs.get('phone')?.data).toEqual({ done: getPhone('maria') })
    expect(docs.get('settings')?.data).toMatchObject({ calm: true })
    expect(docs.get('settings')!.data).not.toHaveProperty('theme')

    // Another device: the server changes, and a pull brings it in.
    docs.set('offers', { version: 1, data: { dismissed: { PC1: ['wifi'] }, sent: [] } })
    sync.setOwner('user-2', 'someone')   // forget what this device knew
    sync.setOwner('user-1', 'maria')
    await sync.pull()
    expect(getOfferState('maria').dismissed).toEqual({ PC1: ['wifi'] })
    expect(getExtras('maria')).toBeDefined()
    expect(getSettings().calm).toBe(true)
    updateOfferState('maria', (s) => ({ ...s, sent: [1] }))
    await sync.flush()
    expect((docs.get("offers")!.data as { sent: number[] }).sent).toEqual([1])
    expect(EMPTY_OFFER_STATE.sent).toEqual([])
    setRemote(null)
  })
})

describe('private notes and health details', () => {
  it('stay on the device until the guest agrees, then follow them, and are deleted when they withdraw', async () => {
    docs.clear()
    registerSyncBindings()
    setRemote(remote)
    switchSettingsOwner({ id: 'gerald', defaultTextSize: DEFAULT_TEXT_SIZE } as never)
    sync.setOwner('user-9', 'gerald')
    await sync.pull()

    updateMemory('gerald', (m) => ({ ...m, medical: { ...m.medical, allergies: ['peanuts'] }, allergy: { ...m.allergy } }))
    await sync.flush()
    expect(docs.has('memory')).toBe(false)
    expect(docs.has('health')).toBe(false)

    await setKeepPrivate(true)
    expect((docs.get('health')!.data as { medical: { allergies: string[] } }).medical.allergies).toEqual(['peanuts'])
    expect(getSettings().syncPrivate).toBe(true)

    // A second device with an empty copy gets it.
    sync.setOwner('user-x', 'other')
    sync.setOwner('user-9', 'gerald')
    applyRemoteMemory('gerald', EMPTY_MEMORY)
    await sync.pull()
    expect(getMemory('gerald').medical.allergies).toEqual(['peanuts'])

    expect(await setKeepPrivate(false)).toBe(true)
    expect(docs.has('memory')).toBe(false)
    expect(docs.has('health')).toBe(false)
    expect(getMemory('gerald').medical.allergies).toEqual(['peanuts'])   // this device keeps its own
    setRemote(null)
  })
})

describe('trip, plan changes, family hub and the booking\'s shared records', () => {
  it('trip, pilot and hub follow the person; port and party follow the booking, under its booker', async () => {
    docs.clear()
    const shared = new Map<string, RemoteDoc>()
    const sharedRemote: Remote = {
      ...remote,
      get: async (key, booking) => (booking ? shared.get(key) ?? null : docs.get(key) ?? null),
      put: async (key, data, base, booking) => {
        const table = booking ? shared : docs
        const cur = table.get(key)?.version ?? 0
        if (cur !== base) throw new Error('stale')
        const doc = { version: cur + 1, data }
        table.set(key, doc)
        return doc
      },
      bookingNumber: async () => 'PC7',
    }
    registerSyncBindings()
    setRemote(sharedRemote)
    switchSettingsOwner({ id: 'priya', defaultTextSize: DEFAULT_TEXT_SIZE } as never)
    sync.setOwner('user-p', 'priya')
    await sync.pull()

    updatePilot('priya', (s) => ({ ...s, gentle: true }))
    updateTrip('priya', (s) => ({ ...s, embark: { ...s.embark, window: '11:00' } }))
    updateHub('priya', (s) => ({ ...s, debriefs: s.debriefs }))
    updateParty('daniel', (s) => ({ ...s, invites: [{ id: 'i1', email: 'gran@example.com', at: 1 }] }))   // the booker's key, as the screens use
    await sync.flush()
    expect((docs.get('pilot')!.data as { gentle: boolean }).gentle).toBe(true)
    expect((docs.get('trip')!.data as { embark: { window: string } }).embark.window).toBe('11:00')
    expect(docs.has('hub')).toBe(true)
    expect(shared.get('party')?.data).toEqual({ invites: [{ id: 'i1', email: 'gran@example.com', at: 1 }], notes: [] })
    expect(docs.has('party')).toBe(false)   // not filed under the person

    // Another adult on the booking, on another device, picks it up.
    shared.set('port', { version: 1, data: { party: { days: {}, alertBefore: 90, rendezvous: [] }, split: { parties: [], items: [], settledAt: null } } })
    sync.setOwner('user-x', 'someone')
    sync.setOwner('user-p', 'priya')
    updateParty('daniel', () => EMPTY_PARTY)
    await sync.pull()
    expect(getParty('daniel').invites).toHaveLength(1)
    expect(getPort('daniel').party.alertBefore).toBe(90)
    setRemote(null)
  })
})
