import { describe, expect, it } from 'vitest'
import { EMPTY_OFFER_STATE } from '../domain/offers'
import { getOfferState, updateOfferState } from '../offers/store'
import { applyRemoteMemory, EMPTY_MEMORY, getMemory, updateMemory } from '../memory/store'
import { getPhone, updatePhone } from '../phone/store'
import { DEFAULT_TEXT_SIZE } from '../design/textSize'
import { getSettings, switchSettingsOwner, updateSettings } from '../settings/store'
import { getExtras } from '../shop/store'
import { EMPTY_CALM } from '../domain/calm'
import { EMPTY_HOME } from '../domain/homeLink'
import { EMPTY_HUB, updateHub } from '../hub/store'
import { updateTrip } from '../journey/store'
import { EMPTY_PILOT, getPilot, updatePilot } from '../pilot/store'
import { getPort } from '../port/store'
import { EMPTY_PARTY } from '../domain/party'
import { getParty, updateParty } from '../party/store'
import { getThread, setThread } from '../ai/history'
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
    setThread('gerald', [{ id: 'u1', role: 'user', text: 'Where can we eat?', at: 1 }])
    await sync.flush()
    expect(docs.has('memory')).toBe(false)
    expect(docs.has('health')).toBe(false)
    expect(docs.has('concierge')).toBe(false)

    await setKeepPrivate(true)
    expect((docs.get('concierge')!.data as { messages: { text: string }[] }).messages[0].text).toBe('Where can we eat?')
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
    expect(docs.has('concierge')).toBe(false)
    expect(getThread('gerald').messages).toHaveLength(1)
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
    updateHub('priya', (s) => ({ ...s, delay: { ...s.delay, shareEta: false } }))
    updateParty('daniel', (s) => ({ ...s, invites: [{ id: 'i1', email: 'gran@example.com', at: 1 }] }))   // the booker's key, as the screens use
    await sync.flush()
    expect((docs.get('pilot')!.data as { gentle: boolean }).gentle).toBe(true)
    expect((docs.get('trip')!.data as { embark: { window: string } }).embark.window).toBe('11:00')
    expect(docs.has('hub')).toBe(true)
    expect((docs.get('hub')!.data as { delay: { shareEta: boolean } }).delay.shareEta).toBe(false)
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

describe('calm profile and family contacts', () => {
  it('stay out of the pilot and hub documents, wait for the guest to agree, and are scrubbed from an older copy', async () => {
    docs.clear()
    registerSyncBindings()
    setRemote(remote)
    switchSettingsOwner({ id: 'maria', defaultTextSize: DEFAULT_TEXT_SIZE } as never)
    updateSettings({ syncPrivate: false })
    // An older version of the app left both inside the plain documents.
    docs.set('pilot', { version: 1, data: { ...EMPTY_PILOT, gentle: true, calm: { ...EMPTY_CALM, cognitive: true } } })
    docs.set('hub', { version: 1, data: { ...EMPTY_HUB, home: { ...EMPTY_HOME, secret: 'abc', contacts: [{ id: 'c1', name: 'Gran', email: 'gran@example.com' }] } } })
    sync.setOwner('user-m', 'maria')
    await sync.pull()
    await sync.flush()
    expect(getPilot('maria').gentle).toBe(true)
    expect((docs.get('pilot')!.data as { calm: { cognitive: boolean } }).calm.cognitive).toBe(false)
    expect((docs.get('hub')!.data as { home: { contacts: unknown[] } }).home.contacts).toEqual([])

    updatePilot('maria', (s) => ({ ...s, calm: { ...s.calm, cognitive: true } }))
    updateHub('maria', (s) => ({ ...s, home: { ...s.home, contacts: [{ id: 'c1', name: 'Gran', email: 'gran@example.com' }] } }))
    await sync.flush()
    expect(docs.has('calm')).toBe(false)
    expect(docs.has('family')).toBe(false)

    await setKeepPrivate(true)
    expect((docs.get('calm')!.data as { cognitive: boolean }).cognitive).toBe(true)
    expect((docs.get('family')!.data as { contacts: { email: string }[] }).contacts[0].email).toBe('gran@example.com')
    expect((docs.get('pilot')!.data as { calm: { cognitive: boolean } }).calm.cognitive).toBe(false)

    expect(await setKeepPrivate(false)).toBe(true)
    expect(docs.has('calm')).toBe(false)
    expect(docs.has('family')).toBe(false)
    expect(getPilot('maria').calm.cognitive).toBe(true)   // this device keeps its own
    setRemote(null)
  })
})
