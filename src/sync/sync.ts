import { isApiError } from '../api/errors'

/**
 * Keeps small per-person documents the same on every device (docs/multi-device-plan.md).
 *
 * Each document is one key on the server (`GET/PUT /me/state/{key}`) with a version that goes up on every save. A store keeps working
 * from its own device copy and tells this module when it changed; this module pushes the change (after a short pause, and again later
 * if the device is offline) and pulls newer copies at sign-in, when the tab is shown again and when the connection returns.
 * Framework-free so it is tested in node. With no remote (mock mode) every call does nothing.
 */
export interface RemoteDoc { version: number; data: unknown }

export interface Remote {
  /** The saved document, or null when nothing is saved. */
  get(key: string): Promise<RemoteDoc | null>
  /** Saves based on the version last seen (0 for none); rejects with an ApiError `conflict` when another device saved first. */
  put(key: string, data: unknown, baseVersion: number): Promise<RemoteDoc>
}

/** How one store plugs in. `localId` is whatever the store keys its device copy by (a persona id, or null). */
export interface Binding {
  key: string
  /** The value to send, taken from the store. */
  read(localId: string | null): unknown
  /** Puts a server copy into the store (cache, device copy, subscribers) WITHOUT telling this module it changed. `null` means "reset to empty". */
  apply(localId: string | null, raw: unknown): void
  /** True when the store holds nothing the guest has entered yet, so there is nothing worth sending. */
  isEmpty(raw: unknown): boolean
  /** Combines the server copy with this device's after a clash; without it this device's copy wins. */
  merge?(remote: unknown, local: unknown): unknown
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

const MAX_TRIES = 3

export function createSync(opts: SyncOptions) {
  const delay = opts.delayMs ?? 800
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const bindings = new Map<string, Binding>()
  const states = new Map<string, KeyState>()
  let account: string | null = null
  let localId: string | null = null
  let status: SyncStatus = 'idle'

  const stateOf = (key: string): KeyState => {
    let s = states.get(key)
    if (!s) { s = { version: 0, pulled: false, dirty: false, timer: null, running: null }; states.set(key, s) }
    return s
  }
  const setStatus = (next: SyncStatus) => { if (status !== next) { status = next; opts.onStatus?.(next) } }
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

  /** Still the same person on this device after an await. */
  const current = (acct: string | null) => acct !== null && acct === account

  async function push(key: string, b: Binding, acct: string): Promise<void> {
    const remote = opts.remote()
    const s = stateOf(key)
    if (!remote || !s.pulled) return
    for (let tries = 0; tries < MAX_TRIES; tries++) {
      s.dirty = false
      const sent = b.read(localId)
      try {
        const doc = await remote.put(key, sent, s.version)
        if (!current(acct)) return
        s.version = doc.version
        if (!same(sent, b.read(localId))) s.dirty = true   // changed while saving: send again
        return
      } catch (e) {
        if (!current(acct)) return
        s.dirty = true
        if (!isApiError(e) || e.code !== 'conflict') throw e
        const latest = await remote.get(key)
        if (!current(acct)) return
        s.version = latest?.version ?? 0
        if (latest && b.merge) b.apply(localId, b.merge(latest.data, b.read(localId)))
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
        while (s.dirty && s.pulled && current(acct) && opts.remote()) await push(key, b, acct)
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
    if (!remote) return
    const s = stateOf(key)
    const doc = await remote.get(key)
    if (!current(acct)) return
    s.pulled = true
    if (!doc) {
      s.version = 0
      // Only a known person's device copy is theirs to send: a null id is shared by every account without a persona.
      if (localId !== null && !b.isEmpty(b.read(localId))) { s.dirty = true; await run(key) }
      else if (localId === null) b.apply(localId, null)
      return
    }
    s.version = doc.version
    if (s.dirty) { await run(key); return }   // the guest changed it before the first pull finished: theirs wins
    if (!same(doc.data, b.read(localId))) b.apply(localId, doc.data)
  }

  return {
    register(b: Binding): void { bindings.set(b.key, b) },

    /** Who is signed in (true when that is a different person from before): the server's user id (null when signed out or in mock mode) and the id the stores key their device copy by. */
    setOwner(accountId: string | null, local: string | null): boolean {
      if (accountId === account && local === localId) return false   // a token refresh, not a change of person
      for (const s of states.values()) if (s.timer !== null) clearTimer(s.timer)
      states.clear()
      account = accountId
      localId = local
      setStatus('idle')
      return true
    },

    /** A store changed `key` for `forLocalId`; send it soon. */
    changed(key: string, forLocalId: string | null): void {
      if (!account || forLocalId !== localId || !bindings.has(key) || !opts.remote()) return
      stateOf(key).dirty = true
      schedule(key)
    },

    /** Fetches every registered key (sign-in, tab shown, back online) and sends anything still waiting. Never throws. */
    async pull(): Promise<void> {
      const acct = account
      if (!acct || !opts.remote()) return
      setStatus('syncing')
      let failed = false
      await Promise.all([...bindings].map(async ([key, b]) => {
        try {
          if (stateOf(key).pulled) { if (stateOf(key).dirty) await run(key); else await pullKey(key, b, acct) }
          else await pullKey(key, b, acct)
        } catch { failed = true }
      }))
      if (current(acct)) setStatus(failed ? 'error' : 'idle')
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
