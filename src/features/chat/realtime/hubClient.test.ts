import { describe, expect, it } from 'vitest'
import { createHubConnection, frame, hubUrl, parseFrames, PING_MS, RECONNECT_WAITS, SILENCE_MS, type HubSocket, type HubState, type HubTimers } from './hubClient'

function fakeTimers() {
  let now = 0
  let next = 1
  const pending = new Map<number, { at: number; fn: () => void }>()
  const timers: HubTimers = {
    setTimeout: (fn, ms) => { const id = next++; pending.set(id, { at: now + ms, fn }); return id },
    clearTimeout: (id) => { pending.delete(id as number) },
  }
  const advance = (ms: number) => {
    const end = now + ms
    for (;;) {
      const due = [...pending.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      pending.delete(due[0]); now = due[1].at; due[1].fn()
    }
    now = end
  }
  return { timers, advance, count: () => pending.size }
}

function setup(url: () => string | null = () => 'ws://x/hubs/chat?access_token=t') {
  const f = fakeTimers()
  const sockets: (HubSocket & { sent: string[]; closed: boolean })[] = []
  const events: [string, unknown[]][] = []
  const states: HubState[] = []
  const hub = createHubConnection({
    url, timers: f.timers,
    onEvent: (t, a) => events.push([t, a]),
    onState: (s) => states.push(s),
    open: () => {
      const s = { sent: [] as string[], closed: false, onopen: null, onmessage: null, onclose: null, onerror: null, send(d: string) { this.sent.push(d) }, close() { this.closed = true } } as HubSocket & { sent: string[]; closed: boolean }
      sockets.push(s)
      return s
    },
  })
  const live = () => { const s = sockets[sockets.length - 1]; s.onopen?.(); s.onmessage?.({ data: '{}\u001e' }); return s }
  return { hub, f, sockets, events, states, live }
}

describe('hub address and frames', () => {
  it('uses the API origin, the hub path and ws or wss, and needs a token', () => {
    expect(hubUrl('/api/v1', 'https://app.example/x', 'a b')).toBe('wss://app.example/hubs/chat?access_token=a%20b')
    expect(hubUrl('http://localhost:5182/api/v1', 'http://localhost:5173/', 't')).toBe('ws://localhost:5182/hubs/chat?access_token=t')
    expect(hubUrl('/api/v1', 'https://app.example/', null)).toBeNull()
  })
  it('splits frames on the record separator and skips bad ones', () => {
    expect(parseFrames('{"type":6}\u001e{"type":1,"target":"a","arguments":[]}\u001e')).toEqual([{ type: 6 }, { type: 1, target: 'a', arguments: [] }])
    expect(parseFrames('nope\u001e{}\u001e')).toEqual([{}])
  })
})

describe('hub connection', () => {
  it('shakes hands, goes live and passes events on', () => {
    const t = setup()
    t.hub.start()
    const s = t.live()
    expect(s.sent[0]).toBe(frame({ protocol: 'json', version: 1 }))
    expect(t.hub.state()).toBe('live')
    s.onmessage?.({ data: frame({ type: 1, target: 'chatChanged', arguments: [{ id: 'k', kind: 'request' }] }) })
    expect(t.events).toEqual([['chatChanged', [{ id: 'k', kind: 'request' }]]])
  })
  it('passes an event that arrives in the same message as the handshake answer', () => {
    const t = setup()
    t.hub.start()
    const s = t.sockets[0]
    s.onopen?.()
    s.onmessage?.({ data: '{}\u001e' + frame({ type: 1, target: 'chatChanged', arguments: [] }) })
    expect(t.events).toHaveLength(1)
  })
  it('sends an acknowledgement only when live', () => {
    const t = setup()
    t.hub.start()
    t.hub.send('Ack', ['k'])
    expect(t.sockets[0].sent).toEqual([])
    const s = t.live()
    t.hub.send('Ack', ['k'])
    expect(s.sent.at(-1)).toBe(frame({ type: 1, target: 'Ack', arguments: ['k'] }))
  })
  it('pings so a quiet connection stays open', () => {
    const t = setup()
    t.hub.start()
    const s = t.live()
    t.f.advance(PING_MS)
    expect(s.sent.at(-1)).toBe(frame({ type: 6 }))
  })
  it('reconnects after a close with growing waits, and starts the count again once live', () => {
    const t = setup()
    t.hub.start()
    t.sockets[0].onclose?.()
    expect(t.hub.state()).toBe('waiting')
    t.f.advance(RECONNECT_WAITS[0] - 1)
    expect(t.sockets).toHaveLength(1)
    t.f.advance(1)
    expect(t.sockets).toHaveLength(2)
    t.sockets[1].onerror?.()
    t.f.advance(RECONNECT_WAITS[1])
    expect(t.sockets).toHaveLength(3)
    t.live()
    t.sockets[2].onclose?.()
    t.f.advance(RECONNECT_WAITS[0])
    expect(t.sockets).toHaveLength(4)
  })
  it('gives up the connection when the server goes silent', () => {
    const t = setup()
    t.hub.start()
    const s = t.live()
    t.f.advance(SILENCE_MS)
    expect(s.closed).toBe(true)
    expect(t.hub.state()).toBe('waiting')
  })
  it('treats a handshake error and a server close as a lost connection', () => {
    const t = setup()
    t.hub.start()
    t.sockets[0].onopen?.()
    t.sockets[0].onmessage?.({ data: '{"error":"no"}\u001e' })
    expect(t.hub.state()).toBe('waiting')
    t.f.advance(RECONNECT_WAITS[0])
    const s = t.live()
    s.onmessage?.({ data: frame({ type: 7 }) })
    expect(t.hub.state()).toBe('waiting')
  })
  it('waits without a token and stops cleanly', () => {
    let token: string | null = null
    const t = setup(() => (token ? 'ws://x' : null))
    t.hub.start()
    expect(t.sockets).toHaveLength(0)
    token = 't'
    t.f.advance(RECONNECT_WAITS[0])
    expect(t.sockets).toHaveLength(1)
    t.hub.stop()
    expect(t.hub.state()).toBe('idle')
    expect(t.f.count()).toBe(0)
    t.f.advance(60000)
    expect(t.sockets).toHaveLength(1)
  })
})
