import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

/**
 * N3.1 and the "done when": a notice the server creates reaches the service worker. The payload below is exactly what `PushMessage.ToJson` in the server
 * produces for the simulated sender's message, and `public/push-sw.js` is the real script, run against a stand-in for the worker's global scope.
 */
const SOURCE = readFileSync('public/push-sw.js', 'utf8')

type Handler = (event: unknown) => void
function load() {
  const handlers: Record<string, Handler> = {}
  const shown: { title: string; options: Record<string, unknown> }[] = []
  const posted: unknown[] = []
  const focused = vi.fn()
  const opened = vi.fn()
  let clients: { postMessage: (m: unknown) => void; focus: () => Promise<void> }[] = [{ postMessage: (m) => posted.push(m), focus: async () => focused() }]
  const self = {
    addEventListener: (type: string, fn: Handler) => { handlers[type] = fn },
    registration: { showNotification: async (title: string, options: Record<string, unknown>) => { shown.push({ title, options }) } },
    clients: { matchAll: async () => clients, openWindow: async (p: string) => opened(p) },
  }
  new Function('self', SOURCE)(self)
  const run = async (type: string, event: Record<string, unknown>) => {
    const waits: Promise<unknown>[] = []
    handlers[type]({ ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await Promise.all(waits)
  }
  return { run, shown, posted, focused, opened, noWindows: () => { clients = [] }, handlers }
}

const serverPayload = (over: Record<string, unknown> = {}) => JSON.stringify({
  id: 'allAboard:2027-03-24:30', kind: 'allAboard', title: 'All aboard soon', body: 'All aboard is at 4:30 pm ship time. About 25 minutes left.', path: '/ship/port', critical: true, params: { port: 'cozumel' }, ...over,
})

describe('the service worker script', () => {
  it('shows a notification for a pushed notice, and a safety notice stays until the guest acts', async () => {
    const sw = load()
    await sw.run('push', { data: { json: () => JSON.parse(serverPayload()) } })
    expect(sw.shown).toHaveLength(1)
    expect(sw.shown[0].title).toBe('All aboard soon')
    expect(sw.shown[0].options).toMatchObject({ tag: 'allAboard:2027-03-24:30', requireInteraction: true, data: { path: '/ship/port' } })
  })

  it('collapses a conversation under its own tag and alerts again, and opens that conversation', async () => {
    const sw = load()
    await sw.run('push', { data: { json: () => JSON.parse(serverPayload({ critical: false, kind: 'chat', id: 'chat:message:c:1', tag: 'chat:conversation:c', path: '/chat?c=3f2504e0-4f89-41d3-9a0c-0305e82c3301' })) } })
    expect(sw.shown[0].options).toMatchObject({ tag: 'chat:conversation:c', renotify: true, data: { path: '/chat?c=3f2504e0-4f89-41d3-9a0c-0305e82c3301' } })
  })

  it('does not renotify for a notice that is its own tag', async () => {
    const sw = load()
    await sw.run('push', { data: { json: () => JSON.parse(serverPayload()) } })
    expect(sw.shown[0].options.renotify).toBe(false)
  })

  it('lets a suggestion fade by itself', async () => {
    const sw = load()
    await sw.run('push', { data: { json: () => JSON.parse(serverPayload({ critical: false, kind: 'payment', id: 'payment:dueSoon:x' })) } })
    expect(sw.shown[0].options.requireInteraction).toBe(false)
  })

  it('tells an open app window, so it can check and update its badge', async () => {
    const sw = load()
    await sw.run('push', { data: { json: () => JSON.parse(serverPayload()) } })
    expect(sw.posted).toEqual([{ type: 'princess-push', id: 'allAboard:2027-03-24:30', kind: 'allAboard' }])
  })

  it('ignores a push with no body, bad JSON, or no title', async () => {
    const sw = load()
    await sw.run('push', { data: null })
    await sw.run('push', { data: { json: () => { throw new SyntaxError('bad') } } })
    await sw.run('push', { data: { json: () => ({ body: 'no title' }) } })
    expect(sw.shown).toHaveLength(0)
  })

  it('never opens an address outside the app', async () => {
    const sw = load()
    for (const path of ['https://evil.example', '//evil.example', 'javascript:1']) await sw.run('push', { data: { json: () => JSON.parse(serverPayload({ path })) } })
    expect(sw.shown.map((n) => (n.options.data as { path: string }).path)).toEqual(['/', '/', '/'])
  })

  it('on tap, brings the open app forward and sends it to the screen', async () => {
    const sw = load()
    const close = vi.fn()
    await sw.run('notificationclick', { notification: { close, data: { path: '/ship/port', id: 'allAboard:2027-03-24:30' } } })
    expect(close).toHaveBeenCalled()
    expect(sw.focused).toHaveBeenCalled()
    expect(sw.posted).toContainEqual({ type: 'princess-open', path: '/ship/port', id: 'allAboard:2027-03-24:30' })
  })

  it('on tap with the app closed, opens it at the screen', async () => {
    const sw = load()
    sw.noWindows()
    await sw.run('notificationclick', { notification: { close: () => undefined, data: { path: '/me/payments' } } })
    expect(sw.opened).toHaveBeenCalledWith('/me/payments')
  })
})

describe('how the script gets into the app', () => {
  it('is loaded by the generated service worker and kept for offline use', () => {
    const config = readFileSync('vite.config.ts', 'utf8')
    expect(config).toContain("importScripts: ['push-sw.js']")
  })
})
