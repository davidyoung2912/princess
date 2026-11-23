/**
 * A small client for the server's SignalR hub (docs/chat-plan.md, phase 3). It speaks SignalR's JSON protocol over a WebSocket (the server allows nothing else),
 * which is a few frames: a handshake, invocations, pings and close. That keeps the large `@microsoft/signalr` package out of the app.
 *
 * Events are only "something changed" nudges; the app refetches over REST, so a lost event costs nothing. The client reconnects with a growing wait,
 * and says plainly whether it is live, so the caller can poll while it is not.
 */

const SEP = '\u001e'

/** The waits between reconnect attempts, in milliseconds; the last one repeats. */
export const RECONNECT_WAITS: readonly number[] = [1000, 2000, 5000, 10000, 30000]
/** The server pings every 15 s; silence for this long means the connection is dead. */
export const SILENCE_MS = 35000
/** The client pings too, so a proxy does not close a quiet connection. */
export const PING_MS = 15000

export type HubState = 'idle' | 'connecting' | 'live' | 'waiting'

export interface HubSocket {
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onmessage: ((e: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
}

export interface HubTimers {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(id: unknown): void
}

export interface HubOptions {
  /** The WebSocket address with the current token, or null when signed out (then nothing connects). Read again at every attempt. */
  url: () => string | null
  /** A server event: its target name and arguments. */
  onEvent: (target: string, args: unknown[]) => void
  onState?: (state: HubState) => void
  open?: (url: string) => HubSocket
  timers?: HubTimers
}

export interface HubConnection {
  start(): void
  stop(): void
  /** Calls a hub method without waiting for an answer. Dropped when not live (the app refetches anyway). */
  send(target: string, args: unknown[]): void
  state(): HubState
}

/** The hub's WebSocket address for an API address (`/api/v1` or `https://host/api/v1`): same origin, `/hubs/chat`, `ws` or `wss`. Null without a token. */
export function hubUrl(apiUrl: string, base: string, token: string | null): string | null {
  if (!token) return null
  let u: URL
  try { u = new URL(apiUrl, base) } catch { return null }
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  u.pathname = '/hubs/chat'
  u.search = `?access_token=${encodeURIComponent(token)}`
  u.hash = ''
  return u.toString()
}

/** One or more frames in a message, split on the record separator. Bad JSON is skipped. */
export function parseFrames(data: string): unknown[] {
  const out: unknown[] = []
  for (const part of data.split(SEP)) {
    if (!part) continue
    try { out.push(JSON.parse(part)) } catch { /* a bad frame is ignored */ }
  }
  return out
}

export const frame = (value: unknown): string => JSON.stringify(value) + SEP

export function createHubConnection(opts: HubOptions): HubConnection {
  const timers: HubTimers = opts.timers ?? { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id as number) }
  const open = opts.open ?? ((url) => new WebSocket(url) as unknown as HubSocket)
  let state: HubState = 'idle'
  let socket: HubSocket | null = null
  let wanted = false
  let attempt = 0
  let retry: unknown = null
  let silence: unknown = null
  let ping: unknown = null
  let shaken = false

  const set = (s: HubState) => { if (s !== state) { state = s; opts.onState?.(s) } }
  const clearAll = () => {
    for (const id of [retry, silence, ping]) if (id !== null) timers.clearTimeout(id)
    retry = silence = ping = null
  }
  const heard = () => {
    if (silence !== null) timers.clearTimeout(silence)
    silence = timers.setTimeout(() => lost(), SILENCE_MS)
  }
  const pingLoop = () => {
    ping = timers.setTimeout(() => { if (shaken) socket?.send(frame({ type: 6 })); pingLoop() }, PING_MS)
  }

  /** The connection is gone or never worked: tidy up and, if still wanted, try again after the next wait. */
  function lost() {
    const s = socket
    socket = null
    shaken = false
    clearAll()
    if (s) { s.onopen = s.onmessage = s.onclose = s.onerror = null; try { s.close() } catch { /* already closed */ } }
    if (!wanted) { set('idle'); return }
    set('waiting')
    const wait = RECONNECT_WAITS[Math.min(attempt, RECONNECT_WAITS.length - 1)]
    attempt++
    retry = timers.setTimeout(connect, wait)
  }

  function connect() {
    retry = null
    if (!wanted) return
    const url = opts.url()
    if (!url) { lost(); return }
    set('connecting')
    let s: HubSocket
    try { s = open(url) } catch { lost(); return }
    socket = s
    s.onopen = () => { s.send(frame({ protocol: 'json', version: 1 })); heard() }
    s.onmessage = (e) => {
      if (socket !== s || typeof e.data !== 'string') return
      heard()
      for (const f of parseFrames(e.data) as Record<string, unknown>[]) {
        if (!shaken) {
          // The first frame answers the handshake: `{}` is good, `{"error": ...}` is not.
          if (f && typeof f === 'object' && 'error' in f) { lost(); return }
          shaken = true
          attempt = 0
          set('live')
          pingLoop()
          if ('type' in f) handle(f)
          continue
        }
        if (handle(f)) return
      }
    }
    s.onclose = () => { if (socket === s) lost() }
    s.onerror = () => { if (socket === s) lost() }
  }

  /** Returns true when the connection was closed by the server. */
  function handle(f: Record<string, unknown>): boolean {
    if (f.type === 1 && typeof f.target === 'string') {
      opts.onEvent(f.target, Array.isArray(f.arguments) ? f.arguments : [])
    } else if (f.type === 7) {
      lost()
      return true
    }
    return false
  }

  return {
    start() { if (wanted) return; wanted = true; attempt = 0; connect() },
    stop() { wanted = false; lost() },
    send(target, args) { if (state === 'live' && shaken) socket?.send(frame({ type: 1, target, arguments: args })) },
    state: () => state,
  }
}
