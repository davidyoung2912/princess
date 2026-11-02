import { describe, expect, it } from 'vitest'
import { EMPTY_OFFER_STATE } from '../domain/offers'
import { getOfferState, updateOfferState } from '../offers/store'
import { getPhone, updatePhone } from '../phone/store'
import { DEFAULT_TEXT_SIZE } from '../design/textSize'
import { getSettings, switchSettingsOwner, updateSettings } from '../settings/store'
import { getExtras } from '../shop/store'
import { registerSyncBindings } from './bindings'
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
