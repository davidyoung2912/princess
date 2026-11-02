import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/errors'
import { addItem, addParty, EMPTY_SPLIT, removeItem } from '../domain/ledgerSplit'
import { EMPTY_PORT_PARTY, setPresence } from '../domain/portParty'
import { layer, type PortRow } from '../port/rows'
import { EMPTY_PORT, type PortState } from '../port/store'
import { createPortRowSync, type PortRowsRemote } from './portRows'

/** A server that keeps the later change of each row, as the real one does. */
const fakeServer = (opts: { legacy?: unknown; readOnly?: boolean } = {}) => {
  let rows: PortRow[] = []
  let legacy: unknown = opts.legacy ?? null
  const calls = { apply: 0, list: 0, dropped: 0, batches: [] as number[] }
  const remote: PortRowsRemote = {
    booking: async () => 'PC1',
    list: async () => { calls.list++; return rows },
    apply: async (_b, ops) => {
      calls.apply++
      calls.batches.push(ops.length)
      if (opts.readOnly) throw new ApiError('forbidden')
      rows = layer(rows, ops)
      return rows
    },
    legacy: async () => legacy,
    dropLegacy: async () => { calls.dropped++; legacy = null },
  }
  return { remote, calls, rows: () => rows }
}

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
}

/** One device: its own copy of the state, its own queue, and a clock it controls. */
const device = (remote: PortRowsRemote | null, clock: { t: number }, start: PortState = EMPTY_PORT) => {
  let state = start
  const storage = memory()
  const sync = createPortRowSync({ remote: () => remote, read: () => state, apply: (_b, s) => { state = s }, storage, now: () => clock.t, setTimer: () => 0, clearTimer: () => {} })
  sync.setOwner('user-1', 'daniel')
  const edit = (change: (s: PortState) => PortState) => { const prev = state; state = change(state); sync.changed('daniel', prev, state) }
  return { sync, edit, state: () => state, storage }
}

const withFamilies = (): PortState => {
  let split = addParty(EMPTY_SPLIT, 'Harper', 4, 'h').state
  split = addParty(split, 'Brennan', 2, 'b').state
  return { party: EMPTY_PORT_PARTY, split }
}
const taxi = (s: PortState, id: string, at: number): PortState => ({ ...s, split: addItem(s.split, { title: id, kind: 'taxi', amount: '20', paidBy: 'h', among: ['h', 'b'], mode: 'equal', date: null }, at, id).state })

describe('port rows through the sync', () => {
  it('a change reaches the other device, and a delete does not come back from the one that still had it', async () => {
    const server = fakeServer()
    const clock = { t: 1_000 }
    const phone = device(server.remote, clock, taxi(withFamilies(), 'taxi', 900))
    const laptop = device(server.remote, clock)
    await phone.sync.pull()   // first time here: the phone's record becomes rows
    await laptop.sync.pull()
    expect(laptop.state().split.items.map((i) => i.id)).toEqual(['taxi'])

    clock.t = 2_000
    laptop.edit((s) => ({ ...s, split: removeItem(s.split, 'taxi') }))
    await laptop.sync.pull()
    // The phone still shows the taxi (it has not pulled); it then pulls and sees it gone.
    expect(phone.state().split.items).toHaveLength(1)
    await phone.sync.pull()
    expect(phone.state().split.items).toEqual([])
    // And a later pull on the laptop does not bring it back.
    await laptop.sync.pull()
    expect(laptop.state().split.items).toEqual([])
  })

  it('an offline device sending an old copy of a deleted row does not undo the delete', async () => {
    const server = fakeServer()
    const clock = { t: 1_000 }
    const phone = device(server.remote, clock)
    const laptop = device(server.remote, clock)
    await phone.sync.pull()
    await laptop.sync.pull()
    clock.t = 1_100
    phone.edit(() => taxi(withFamilies(), 'taxi', 1_100))
    await phone.sync.pull()
    await laptop.sync.pull()
    clock.t = 1_200
    laptop.edit((s) => ({ ...s, split: removeItem(s.split, 'taxi') }))
    await laptop.sync.pull()
    // The phone edits something else, then pulls: it learns of the delete and keeps its own other change.
    clock.t = 1_300
    phone.edit((s) => ({ ...s, party: setPresence(s.party, '2027-03-23', 'daniel', 'back', 1_300) }))
    await phone.sync.pull()
    expect(phone.state().split.items).toEqual([])
    expect(phone.state().party.days['2027-03-23'].presence.daniel.status).toBe('back')
  })

  it('two people changing different things at once keep both, and the same thing goes to the later change', async () => {
    const server = fakeServer()
    const clock = { t: 1_000 }
    const a = device(server.remote, clock)
    const b = device(server.remote, clock)
    await a.sync.pull()
    await b.sync.pull()
    clock.t = 2_000
    a.edit((s) => ({ ...s, party: setPresence(s.party, '2027-03-23', 'daniel', 'back', 2_000) }))
    clock.t = 2_001
    b.edit((s) => ({ ...s, party: setPresence(s.party, '2027-03-23', 'priya', 'leaving', 2_001) }))
    await a.sync.pull()
    await b.sync.pull()
    await a.sync.pull()
    for (const d of [a, b]) expect(Object.keys(d.state().party.days['2027-03-23'].presence).sort()).toEqual(['daniel', 'priya'])

    clock.t = 3_000
    a.edit((s) => ({ ...s, party: setPresence(s.party, '2027-03-23', 'priya', 'ashore', 3_000) }))
    clock.t = 3_500
    b.edit((s) => ({ ...s, party: setPresence(s.party, '2027-03-23', 'priya', 'back', 3_500) }))
    await b.sync.pull()
    await a.sync.pull()
    expect(a.state().party.days['2027-03-23'].presence.priya.status).toBe('back')
  })

  it('changes made while offline wait on the device, survive a restart and are sent later', async () => {
    const server = fakeServer()
    const clock = { t: 1_000 }
    let online = false
    const remote: PortRowsRemote = { ...server.remote, booking: async () => { if (!online) throw new ApiError('offline'); return 'PC1' } }
    const phone = device(remote, clock)
    phone.edit(() => taxi(withFamilies(), 'taxi', 1_000))
    await phone.sync.pull()
    expect(phone.sync.status()).toBe('error')
    expect(phone.sync.waiting()).toBeGreaterThan(0)

    // The app restarts: a new sync reads the queue from the same storage.
    let state = phone.state()
    const again = createPortRowSync({ remote: () => remote, read: () => state, apply: (_b, s) => { state = s }, storage: phone.storage, now: () => clock.t, setTimer: () => 0, clearTimer: () => {} })
    again.setOwner('user-1', 'daniel')
    expect(again.waiting()).toBeGreaterThan(0)
    online = true
    await again.pull()
    expect(again.waiting()).toBe(0)
    expect(server.rows().some((r) => r.kind === 'item' && r.key === 'taxi' && !r.deleted)).toBe(true)
    expect(again.status()).toBe('idle')
  })

  it('imports the old document and the device record once, then drops the document', async () => {
    const legacy = { party: setPresence(EMPTY_PORT_PARTY, '2027-03-23', 'priya', 'back', 40), split: taxi(withFamilies(), 'old', 30).split }
    const server = fakeServer({ legacy })
    const clock = { t: 5_000 }
    const phone = device(server.remote, clock, taxi(withFamilies(), 'mine', 20))
    await phone.sync.pull()
    expect(phone.state().split.items.map((i) => i.id).sort()).toEqual(['mine', 'old'])
    expect(phone.state().party.days['2027-03-23'].presence.priya.status).toBe('back')
    expect(server.calls.dropped).toBe(1)
    const sent = server.calls.apply
    await phone.sync.pull()
    expect(server.calls.apply).toBe(sent)   // nothing more to send
  })

  it('a delete made elsewhere before this device first syncs beats its old copy', async () => {
    const server = fakeServer()
    const clock = { t: 9_000 }
    const early = device(server.remote, clock, taxi(withFamilies(), 'taxi', 100))
    await early.sync.pull()
    clock.t = 9_500
    early.edit((s) => ({ ...s, split: removeItem(s.split, 'taxi') }))
    await early.sync.pull()
    const stale = device(server.remote, clock, taxi(withFamilies(), 'taxi', 100))   // never synced; still has the expense
    await stale.sync.pull()
    expect(stale.state().split.items).toEqual([])
  })

  it('sends in batches of 100', async () => {
    const server = fakeServer()
    const clock = { t: 1_000 }
    let s = withFamilies()
    for (let i = 0; i < 120; i++) s = taxi(s, `e${i}`, i + 1)
    const d = device(server.remote, clock, s)
    await d.sync.pull()
    expect(server.calls.batches.every((n) => n <= 100)).toBe(true)
    expect(server.rows().filter((r) => r.kind === 'item')).toHaveLength(120)
  })

  it('a child who may not change the record drops the queue and reads the rows', async () => {
    const server = fakeServer({ readOnly: true })
    const clock = { t: 1_000 }
    const child = device(server.remote, clock)
    await child.sync.pull()
    child.edit((s) => ({ ...s, party: setPresence(s.party, '2027-03-23', 'maya', 'back', 1) }))
    await child.sync.pull()
    expect(child.sync.waiting()).toBe(0)
    expect(child.sync.status()).toBe('idle')
  })

  it('does nothing without a remote or a signed-in person', async () => {
    const clock = { t: 1 }
    const offline = device(null, clock)
    offline.edit(() => taxi(withFamilies(), 'x', 1))
    await offline.sync.pull()
    expect(offline.sync.waiting()).toBe(0)
    const server = fakeServer()
    const out = device(server.remote, clock)
    out.sync.setOwner(null, null)
    out.edit(() => taxi(withFamilies(), 'x', 1))
    await out.sync.pull()
    expect(server.calls.apply + server.calls.list).toBe(0)
  })
})
