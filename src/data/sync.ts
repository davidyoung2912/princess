/** Tells other open tabs that data changed, so a family member's chat and shared plans appear without a reload. */
export interface ChangeMessage {
  type: 'records' | 'demo' | 'session'
  /** For 'records': the kind that changed. */
  kind?: string
  /** For 'records': whose data changed ('' = shared). */
  owner?: string
}

export interface Channel {
  post(message: ChangeMessage): void
  subscribe(listener: (message: ChangeMessage) => void): () => void
  close(): void
}

export interface ChannelLike {
  postMessage(m: unknown): void
  addEventListener(type: 'message', l: (e: { data: unknown }) => void): void
  removeEventListener(type: 'message', l: (e: { data: unknown }) => void): void
  close(): void
}

const isChange = (m: unknown): m is ChangeMessage => !!m && typeof m === 'object' && ['records', 'demo', 'session'].includes((m as { type?: string }).type ?? '')

/** A channel over BroadcastChannel; where the browser has none, it does nothing (single tab still works). */
export function createChannel(name = 'princess', make: ((name: string) => ChannelLike) | null = typeof BroadcastChannel === 'function' ? (n) => new BroadcastChannel(n) : null): Channel {
  const bc = make?.(name) ?? null
  const listeners = new Set<(m: ChangeMessage) => void>()
  const onMessage = (e: { data: unknown }) => { if (isChange(e.data)) listeners.forEach((l) => l(e.data as ChangeMessage)) }
  bc?.addEventListener('message', onMessage)
  return {
    post: (m) => bc?.postMessage(m),
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    close: () => { bc?.removeEventListener('message', onMessage); bc?.close(); listeners.clear() },
  }
}
