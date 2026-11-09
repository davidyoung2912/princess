import { isApiError } from '../api/errors'

/**
 * Keeps small per-person documents the same on every device (docs/multi-device-plan.md).
 *
 * Each document is one key on the server (`GET/PUT /me/state/{key}`) with a version that goes up on every save. A store keeps working
 * from its own device copy and tells this module when it changed; this module pushes the change (after a short pause, and again later
 * if the device is offline) and pulls newer copies at sign-in, when the tab is shown again and when the connection returns.
 * Framework-free so it is tested in node. The server is always the source: a new or cleared device pulls, and nothing is imported from a device copy. With no remote every call does nothing.
 */
export interface RemoteDoc { version: number; data: unknown }

export interface Remote {
  /** The saved document, or null when nothing is saved. `booking` is the booking number for a document shared by everyone on a booking; absent means the signed-in person's own. */
  get(key: string, booking?: string): Promise<RemoteDoc | null>
  /** Saves based on the version last seen (0 for none); rejects with an ApiError `conflict` when another device saved first. */
  put(key: string, data: unknown, baseVersion: number, booking?: string): Promise<RemoteDoc>
  /** Deletes the saved document (nothing saved is fine). */
  remove(key: string, booking?: string): Promise<void>
  /** The number of the booking shared documents belong to (the current trip), or null when the person has none. Needed only for `scope: 'booking'` bindings. */
  bookingNumber?(): Promise<string | null>
}

/** How one store plugs in. `localId` is whatever the store keys its device copy by (a persona id, or null). */
export interface Binding {
  key: string
  /** `'booking'`: one document for everyone on the booking (adults write, everyone reads). Absent: the signed-in person's own. */
  scope?: 'booking'
  /** The id the store keys its device copy by, when that is not the signed-in person's (a booking's store is keyed by its booker). */
  localFor?(localId: string | null): string | null
  /** The value to send, taken from the store. */
  read(localId: string | null): unknown
  /** Puts a server copy into the store (cache, device copy, subscribers) WITHOUT telling this module it changed. `null` means "reset to empty". */
  apply(localId: string | null, raw: unknown): void
  /** True when the store holds nothing the guest has entered yet, so there is nothing worth sending. */
  isEmpty(raw: unknown): boolean
  /** Combines the server copy with this device's after a clash; without it this device's copy wins. */
  merge?(remote: unknown, local: unknown): unknown
  /** False while the guest has not agreed to keep this document on the server (health details and private notes): nothing is sent, fetched or kept there. Absent means always on. */
  enabled?(): boolean
  /** The document with the parts this binding no longer keeps there removed (an older copy on the server may still hold them); a pulled copy that changes is sent back cleaned. */
  clean?(raw: unknown): unknown
  /** Called when the server's answer for this key has been dealt with (a saved copy applied, or none saved), so a store can tell "nothing there" from "not asked yet". */
  pulled?(localId: string | null): void
}

export type SyncStatus = 'idle' | 'syncing' | 'error'

export interface SyncOptions {
  remote: () => Remote | null
  /** Pause before a change is sent, so a burst of taps is one save. */
  delayMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  onStatus?: (status: SyncStatus) => void
}

interface KeyState { version: number; pulled: boolean; dirty: boolean; timer: unknown; running: Promise<void> | null }

const allowed = (b: Binding): boolean => b.enabled?.() !== false

const MAX_TRIES = 3

export function createSync(opts: SyncOptions) {
  const delay = opts.delayMs ?? 800
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const bindings = new Map<string, Binding>()
  const states = new Map<string, KeyState>()
  let account: string | null = null
  let localId: string | null = null
  /** The booking shared documents belong to; null until looked up, or when the person has none. */
  let booking: string | null = null
  let status: SyncStatus = 'idle'
  /** Keys whose server copy still has to be deleted (the guest withdrew consent while offline). */
  const removals = new Set<string>()
  /** Keys held back by the guest's choice (never on, or withdrawn): the next pull sends this device's copy if the server has none. */
  const importable = new Set<string>()

  const stateOf = (key: string): KeyState => {
    let s = states.get(key)
    if (!s) { s = { version: 0, pulled: false, dirty: false, timer: null, running: null }; states.set(key, s) }
    return s
  }
  const setStatus = (next: SyncStatus) => { if (status !== next) { status = next; opts.onStatus?.(next) } }
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  /** The id a binding's store keys its device copy by. */
  const idOf = (b: Binding): string | null => (b.localFor ? b.localFor(localId) : localId)
  /** A booking document cannot be fetched or sent until the booking number is known. */
  const ready = (b: Binding): boolean => b.scope !== 'booking' || booking !== null
  const scopeOf = (b: Binding): string | undefined => (b.scope === 'booking' ? booking ?? undefined : undefined)

  /** Still the same person on this device after an await. */
  const current = (acct: string | null) => acct !== null && acct === account

  async function push(key: string, b: Binding, acct: string): Promise<void> {
    const remote = opts.remote()
    const s = stateOf(key)
    if (!remote || !s.pulled || !allowed(b) || !ready(b)) return
    for (let tries = 0; tries < MAX_TRIES; tries++) {
      s.dirty = false
      const sent = b.read(idOf(b))
      try {
        const doc = await remote.put(key, sent, s.version, scopeOf(b))
        if (!current(acct)) return
        s.version = doc.version
        if (!same(sent, b.read(idOf(b)))) s.dirty = true   // changed while saving: send again
        return
      } catch (e) {
        if (!current(acct)) return
        // A child on a booking may read what the adults share but not change it: their edits stay on this device and are not an error.
        if (b.scope === 'booking' && isApiError(e) && e.code === 'forbidden') { s.dirty = false; return }
        s.dirty = true
        if (!isApiError(e) || e.code !== 'conflict') throw e
        const latest = await remote.get(key, scopeOf(b))
        if (!current(acct)) return
        s.version = latest?.version ?? 0
        if (latest && b.merge) b.apply(idOf(b), b.merge(latest.data, b.read(idOf(b))))
      }
    }
    throw new Error('stale')
  }

  function run(key: string): Promise<void> {
    const s = stateOf(key)
    const b = bindings.get(key)
    const acct = account
    if (!b || !acct) return Promise.resolve()
    if (s.running) return s.running
    setStatus('syncing')
    s.running = (async () => {
      try {
        while (s.dirty && s.pulled && allowed(b) && ready(b) && current(acct) && opts.remote()) await push(key, b, acct)
        if (current(acct)) setStatus([...states.values()].some((x) => x.dirty) ? 'error' : 'idle')
      } catch {
        setStatus('error')   // stays dirty: the next change, focus or reconnect tries again
      } finally {
        s.running = null
      }
    })()
    return s.running
  }

  function schedule(key: string): void {
    const s = stateOf(key)
    if (s.timer !== null) clearTimer(s.timer)
    s.timer = setTimer(() => { s.timer = null; void run(key) }, delay)
  }

  async function pullKey(key: string, b: Binding, acct: string): Promise<void> {
    const remote = opts.remote()
    if (!remote || !allowed(b) || !ready(b)) return
    const s = stateOf(key)
    const doc = await remote.get(key, scopeOf(b))
    if (!current(acct)) return
    s.pulled = true
    if (!doc) {
      s.version = 0
      // The server is the source: with nothing saved there, this device's copy is not imported. Two exceptions are the guest's own acts: a change made
      // before this first answer arrived (dirty), and a document kept back until the guest agreed to keep it there.
      if (s.dirty || (importable.has(key) && !b.isEmpty(b.read(idOf(b))))) { importable.delete(key); s.dirty = true; await run(key) }
      else b.apply(idOf(b), null)
      b.pulled?.(idOf(b))
      return
    }
    s.version = doc.version
    if (s.dirty) { await run(key); b.pulled?.(idOf(b)); return }   // the guest changed it before the first pull finished: theirs wins
    if (!same(doc.data, b.read(idOf(b)))) b.apply(idOf(b), doc.data)
    b.pulled?.(idOf(b))
    if (b.clean && !same(b.clean(doc.data), doc.data)) { s.dirty = true; await run(key) }   // sensitive parts an older version left there
  }

  return {
    register(b: Binding): void { bindings.set(b.key, b) },

    /** Who is signed in (true when that is a different person from before): the server's user id (null when signed out) and the id the stores key their device copy by. */
    setOwner(accountId: string | null, local: string | null): boolean {
      if (accountId === account && local === localId) return false   // a token refresh, not a change of person
      for (const s of states.values()) if (s.timer !== null) clearTimer(s.timer)
      states.clear()
      account = accountId
      localId = local
      booking = null
      setStatus('idle')
      return true
    },

    /** A store changed `key` for `forLocalId`; send it soon. */
    changed(key: string, forLocalId: string | null): void {
      const b = bindings.get(key)
      if (!account || !b || forLocalId !== idOf(b) || !allowed(b) || !opts.remote()) return
      stateOf(key).dirty = true
      schedule(key)
    },

    /** Fetches every registered key (sign-in, tab shown, back online) and sends anything still waiting. Never throws. */
    async pull(): Promise<void> {
      const acct = account
      if (!acct || !opts.remote()) return
      setStatus('syncing')
      let failed = false
      // Shared booking documents need the booking number. A new number (a different current trip) means those documents start afresh.
      const needsBooking = [...bindings.values()].some((b) => b.scope === 'booking')
      const lookup = opts.remote()?.bookingNumber
      if (needsBooking && lookup) {
        try {
          const n = await lookup.call(opts.remote())
          if (!current(acct)) return
          if (n !== booking) {
            booking = n
            for (const [key, b] of bindings) if (b.scope === 'booking') { const st = states.get(key); if (st && st.timer !== null) clearTimer(st.timer); states.delete(key) }
          }
        } catch { failed = true }
      }
      const one = async (key: string, b: Binding) => {
        try {
          if (removals.has(key)) { await opts.remote()?.remove(key); removals.delete(key); return }
          if (!allowed(b)) { importable.add(key); return }   // held back by the guest's choice: when they turn it on, their copy here goes up
          if (stateOf(key).pulled) { if (stateOf(key).dirty) await run(key); else await pullKey(key, b, acct) }
          else await pullKey(key, b, acct)
        } catch { failed = true }
      }
      const entries = [...bindings]
      // A key that needs consent is looked at again once the others are in: the consent itself may be one of them.
      const waiting = entries.filter(([, b]) => !allowed(b))
      await Promise.all(entries.map(([key, b]) => one(key, b)))
      await Promise.all(waiting.filter(([, b]) => allowed(b)).map(([key, b]) => one(key, b)))
      if (current(acct)) setStatus(failed ? 'error' : 'idle')
    },

    /**
     * The guest turned `key` off: nothing more is sent and the server's copy is deleted (retried at the next pull if that fails). Resolves to whether the server's copy is gone now.
     * Turning it on needs only a `pull()`, which sends this device's copy if the server has none (the only import there is).
     */
    async withdraw(key: string): Promise<boolean> {
      const s = stateOf(key)
      if (s.timer !== null) { clearTimer(s.timer); s.timer = null }
      s.dirty = false; s.pulled = false; s.version = 0
      if (!account) return true
      removals.add(key)
      importable.add(key)
      const acct = account
      try {
        await opts.remote()?.remove(key)
        removals.delete(key)
        return true
      } catch {
        if (current(acct)) setStatus('error')
        return false
      }
    },

    /** Sends waiting changes now (before sign-out). */
    async flush(): Promise<void> {
      await Promise.all([...states].map(async ([key, s]) => {
        if (s.timer !== null) { clearTimer(s.timer); s.timer = null }
        if (s.dirty) await run(key)
      }))
    },

    status: (): SyncStatus => status,
  }
}

export type Sync = ReturnType<typeof createSync>
