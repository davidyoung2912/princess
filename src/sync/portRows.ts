import { isApiError } from '../api/errors'
import { APP_PREFIX } from '../data/lifecycle'
import { diffState, layer, legacyRows, rowId, stateOfRows, type PortRow } from '../port/rows'
import { applyRemotePort, getPort, normalizePort, onPortChanged, type PortState } from '../port/store'
import { bookerOfPerson } from '../account/context'
import type { SyncStatus } from './sync'

/**
 * Keeps the port day's rows the same on every device of a booking (multi-device plan 2, Phase 6). Each change a person makes becomes row changes
 * (`port/rows.ts`), waits in a short queue kept on this device, and is sent after a pause; the server keeps the later change of each row and answers with
 * every row, which becomes the state shown. A delete is a row that stays, so nothing comes back from another device. Framework-free; with no remote
 * (mock mode) every call does nothing.
 */
export interface PortRowsRemote {
  /** The number of the booking the rows belong to (the current trip), or null when the person has none. */
  booking(): Promise<string | null>
  list(booking: string): Promise<PortRow[]>
  /** Sends changes (at most 100); resolves to every row of the booking. */
  apply(booking: string, ops: PortRow[]): Promise<PortRow[]>
  /** The `port` document an older version of the app kept for the booking, or null. */
  legacy(booking: string): Promise<unknown>
  /** Deletes that document once its contents are in rows. */
  dropLegacy(booking: string): Promise<void>
}

export interface PortRowSyncOptions {
  remote: () => PortRowsRemote | null
  read?: (booker: string | null) => PortState
  apply?: (booker: string | null, state: PortState) => void
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  delayMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  now?: () => number
  onStatus?: (status: SyncStatus) => void
}

const BATCH = 100

/** The id the port store keys its device copy by: the booker of the booking the person is on. */
export const bookerOf = bookerOfPerson

function deviceStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function createPortRowSync(opts: PortRowSyncOptions) {
  const read = opts.read ?? getPort
  const apply = opts.apply ?? applyRemotePort
  const storage = opts.storage === undefined ? deviceStorage() : opts.storage
  const delay = opts.delayMs ?? 800
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const now = opts.now ?? Date.now

  let account: string | null = null
  let booker: string | null = null
  let status: SyncStatus = 'idle'
  let timer: unknown = null
  let running: Promise<void> | null = null
  /** Changes not yet accepted by the server, the latest for each row. Kept on the device so a change made offline survives a reload. */
  let pending = new Map<string, PortRow>()
  /** The rows as last known: the server's, with the pending changes laid over them. */
  let known = new Map<string, PortRow>()

  const pendingKey = (b: string): string => `${APP_PREFIX}portops:${b}`
  const doneKey = (b: string): string => `${APP_PREFIX}portrows:${b}`
  const setStatus = (next: SyncStatus) => { if (status !== next) { status = next; opts.onStatus?.(next) } }
  const current = (acct: string | null) => acct !== null && acct === account

  const savePending = () => {
    if (booker === null) return
    try { storage?.setItem(pendingKey(booker), JSON.stringify([...pending.values()])) } catch { /* the queue then lives only until a reload */ }
  }
  const loadPending = (b: string): Map<string, PortRow> => {
    try {
      const text = storage?.getItem(pendingKey(b))
      const rows = text ? (JSON.parse(text) as unknown) : []
      return new Map((Array.isArray(rows) ? rows : []).flatMap((r): [string, PortRow][] => {
        const row = r as PortRow
        return row && typeof row.kind === 'string' && typeof row.key === 'string' && typeof row.at === 'number' ? [[rowId(row), row]] : []
      }))
    } catch {
      return new Map()
    }
  }
  /** The booking this device last put its record into rows for. */
  const importedFor = (b: string): string | null => { try { return storage?.getItem(doneKey(b)) ?? null } catch { return null } }
  const markImported = (b: string, booking: string) => { try { storage?.setItem(doneKey(b), booking) } catch { /* it is then imported again, which changes nothing */ } }

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

  /** Takes the server's rows (with anything still waiting laid over them) as the state shown. */
  function take(b: string, rows: readonly PortRow[]): void {
    const merged = layer(rows, [...pending.values()])
    known = new Map(merged.map((r) => [rowId(r), r]))
    const state = stateOfRows(merged)
    if (!same(state, read(b))) apply(b, state)
  }

  async function send(remote: PortRowsRemote, booking: string, ops: PortRow[]): Promise<PortRow[]> {
    let rows: PortRow[] = []
    for (let i = 0; i < ops.length; i += BATCH) rows = await remote.apply(booking, ops.slice(i, i + BATCH))
    return rows
  }

  /** One exchange with the server: import this device's old record the first time, send what waits, take what the server has. */
  async function round(acct: string): Promise<void> {
    const remote = opts.remote()
    const b = booker
    if (!remote || b === null || !current(acct)) return
    const booking = await remote.booking()
    if (!current(acct) || b !== booker) return
    if (booking === null) return
    const sentOps = [...pending.values()]
    let toSend = sentOps
    let legacy: unknown = null
    const first = importedFor(b) !== booking
    if (first) {
      legacy = await remote.legacy(booking)
      if (!current(acct)) return
      // What the old document and this device hold, as rows with small stamps; anything done since is later than those.
      toSend = layer(layer(legacyRows(normalizePort(legacy)), legacyRows(read(b))), sentOps)
    }
    let rows: PortRow[]
    try {
      rows = toSend.length > 0 ? await send(remote, booking, toSend) : await remote.list(booking)
    } catch (e) {
      // A child may read but not change, and a refusal of the rows themselves (a bad row, a full booking) would only repeat: the queue is dropped and the rows are read.
      if (!isApiError(e) || (e.code !== 'forbidden' && e.code !== 'invalid' && e.code !== 'conflict')) throw e
      rows = await remote.list(booking)
      pending = new Map()
      savePending()
      if (!current(acct)) return
      if (first) markImported(b, booking)
      take(b, rows)
      return
    }
    if (!current(acct) || b !== booker) return
    // Changes made while sending stay waiting; the ones sent are done.
    for (const op of sentOps) if (pending.get(rowId(op)) === op) pending.delete(rowId(op))
    savePending()
    if (first) {
      markImported(b, booking)
      if (legacy !== null) await remote.dropLegacy(booking).catch(() => {})
    }
    take(b, rows)
  }

  function run(): Promise<void> {
    const acct = account
    if (!acct || !opts.remote()) return Promise.resolve()
    if (running) return running
    setStatus('syncing')
    running = (async () => {
      try {
        await round(acct)
        // Changed while sending: go round again.
        if (current(acct) && pending.size > 0 && opts.remote()) await round(acct)
        if (current(acct)) setStatus(pending.size > 0 ? 'error' : 'idle')
      } catch {
        setStatus('error')   // the queue stays: the next change, focus or reconnect tries again
      } finally {
        running = null
      }
    })()
    return running
  }

  const schedule = () => {
    if (timer !== null) clearTimer(timer)
    timer = setTimer(() => { timer = null; void run() }, delay)
  }

  return {
    /** Who is signed in (true when that is a different person from before): the server's user id and the id the port store keys its device copy by. */
    setOwner(accountId: string | null, local: string | null): boolean {
      const b = bookerOf(local)
      if (accountId === account && b === booker) return false
      if (timer !== null) { clearTimer(timer); timer = null }
      account = accountId
      booker = b
      known = new Map()
      pending = b === null ? new Map() : loadPending(b)
      setStatus('idle')
      return true
    },

    /** A person changed the record on this device: the changed rows are queued and sent soon. */
    changed(forBooker: string | null, prev: PortState, next: PortState): void {
      if (!account || forBooker === null || forBooker !== booker || !opts.remote()) return
      const t = now()
      for (const op of diffState(prev, next, t)) {
        const id = rowId(op)
        // Later than anything this device knows of that row, so a clock a little behind another device's still wins its own change.
        const floor = Math.max(pending.get(id)?.at ?? 0, known.get(id)?.at ?? 0)
        const row = { ...op, at: Math.max(op.at, floor + 1) }
        pending.set(id, row)
        known.set(id, row)
      }
      savePending()
      schedule()
    },

    /** Fetches the rows (sign-in, tab shown, back online) and sends anything waiting. Never throws. */
    pull: (): Promise<void> => run(),

    /** Sends waiting changes now (before sign-out). */
    async flush(): Promise<void> {
      if (timer !== null) { clearTimer(timer); timer = null }
      if (pending.size > 0) await run()
    },

    status: (): SyncStatus => status,
    /** How many changes still wait to be accepted (for tests and the sync indicator). */
    waiting: (): number => pending.size,
  }
}

export type PortRowSync = ReturnType<typeof createPortRowSync>

let remote: PortRowsRemote | null = null
const listeners = new Set<() => void>()

/** The one row sync the port store tells about changes. The runtime gives it a remote only when the app talks to the real API. */
export const portRows = createPortRowSync({ remote: () => remote, onStatus: () => listeners.forEach((l) => l()) })
export const setPortRowsRemote = (r: PortRowsRemote | null): void => { remote = r }
export const subscribePortRowStatus = (listener: () => void): (() => void) => { listeners.add(listener); return () => listeners.delete(listener) }
onPortChanged((booker, prev, next) => portRows.changed(booker, prev, next))
