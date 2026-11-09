import { describe, expect, it } from 'vitest'
import { createHttp, errorFor } from '../api/http'
import { createHttpAuthProvider, REFRESH_KEY } from './httpProvider'

const memory = () => {
  const m = new Map<string, string>()
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}
const user = (email: string | null = 'maya@demo.princess.example') => ({ id: 'u1', accountNumber: '4100000001', email, firstName: 'Maya', lastName: 'Harper', role: 'guest', tier: 'none', isDemo: true })
const session = (n: number, email?: string | null) => ({ accessToken: `a${n}`, expiresAt: 0, refreshToken: `r${n}`, refreshExpiresAt: 0, user: user(email) })
const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status })

interface Call { url: string; method: string; auth: string | null; body: string | null }
function server(handler: (c: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const f = (async (url: string, init: RequestInit) => {
    const c = { url, method: init.method ?? 'GET', auth: (init.headers as Record<string, string>).authorization ?? null, body: (init.body as string | undefined) ?? null }
    calls.push(c)
    return handler(c)
  }) as unknown as typeof fetch
  return { calls, f }
}

describe('errorFor', () => {
  it('prefers the server code, then the status', () => {
    expect(errorFor(409, { code: 'declined' }).code).toBe('declined')
    expect(errorFor(404, null).code).toBe('notFound')
    expect(errorFor(503, null)).toMatchObject({ code: 'server', retryable: true })
    expect(errorFor(401, {}).code).toBe('forbidden')
  })
})

describe('createHttp', () => {
  it('sends the bearer token, JSON body and query, and reads 204', async () => {
    const s = server((c) => (c.method === 'GET' ? reply(200, { ok: 1 }) : reply(204)))
    const http = createHttp({ baseUrl: '/api/v1', fetch: s.f, token: () => 'tok', refresh: async () => false, online: () => true })
    expect(await http.get('/x', { query: { a: 1, b: undefined, c: 'd e' } })).toEqual({ ok: 1 })
    expect(s.calls[0]).toMatchObject({ url: '/api/v1/x?a=1&c=d%20e', auth: 'Bearer tok' })
    expect(await http.post('/y', { z: 1 })).toBeUndefined()
    expect(s.calls[1].body).toBe('{"z":1}')
  })
  it('refreshes once on 401 and retries; gives up and signs out when the refresh fails', async () => {
    let token = 'old'
    const s = server((c) => (c.auth === 'Bearer new' ? reply(200, { ok: 1 }) : reply(401)))
    const http = createHttp({ baseUrl: '', fetch: s.f, token: () => token, refresh: async () => { token = 'new'; return true }, online: () => true })
    expect(await http.get('/x')).toEqual({ ok: 1 })
    expect(s.calls.map((c) => c.auth)).toEqual(['Bearer old', 'Bearer new'])
    let out = 0
    const dead = createHttp({ baseUrl: '', fetch: server(() => reply(401)).f, token: () => 't', refresh: async () => false, onSignedOut: () => out++, online: () => true })
    await expect(dead.get('/x')).rejects.toMatchObject({ code: 'forbidden' })
    expect(out).toBe(1)
  })
  it('reports offline, network failure and timeout', async () => {
    const base = { baseUrl: '', token: () => null, refresh: async () => false }
    await expect(createHttp({ ...base, online: () => false }).get('/x')).rejects.toMatchObject({ code: 'offline' })
    const down = (async () => { throw new TypeError('fail') }) as unknown as typeof fetch
    await expect(createHttp({ ...base, fetch: down, online: () => true }).get('/x')).rejects.toMatchObject({ code: 'network' })
    const hang = ((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(new Error('abort'))))) as unknown as typeof fetch
    await expect(createHttp({ ...base, fetch: hang, timeoutMs: 5, online: () => true }).get('/x')).rejects.toMatchObject({ code: 'timeout' })
  })
})

describe('createHttpAuthProvider', () => {
  const make = (handler: (c: Call) => Response, storage = memory()) => {
    const s = server(handler)
    return { s, storage, auth: createHttpAuthProvider({ baseUrl: '/api/v1', storage, fetch: s.f, now: () => 7 }) }
  }
  it('signs in, keeps the access token in memory and the refresh token in the tab, and notifies', async () => {
    const { auth, storage, s } = make(() => reply(200, session(1)))
    let n = 0
    auth.subscribe(() => n++)
    const got = await auth.signIn({ method: 'password', identifier: ' maya@demo.princess.example ', password: 'pw' })
    expect(got).toMatchObject({ method: 'password', signedInAt: 7 })
    expect(JSON.stringify(got)).not.toContain('a1')
    expect(auth.accessToken()).toBe('a1')
    expect(storage.m.get(REFRESH_KEY)).toBe('r1')
    expect(JSON.parse(s.calls[0].body!).identifier).toBe('maya@demo.princess.example')
    expect(s.calls[0].auth).toBeNull()
    expect(n).toBe(1)
  })
  it('maps failures to AuthError codes', async () => {
    await expect(make(() => reply(401, { code: 'badCredentials' })).auth.signIn({ method: 'password', identifier: 'a', password: 'b' })).rejects.toMatchObject({ code: 'badCredentials' })
    await expect(make(() => reply(503)).auth.signIn({ method: 'password', identifier: 'a', password: 'b' })).rejects.toMatchObject({ code: 'unavailable' })
  })
  it('restores from the refresh token after a reload, and drops a refused one', async () => {
    const storage = memory()
    storage.setItem(REFRESH_KEY, 'r1')
    const ok = make(() => reply(200, session(2, 'priya@demo.princess.example')), storage)
    expect(await ok.auth.restore()).toBe(true)
    expect(ok.auth.current()?.user?.email).toBe('priya@demo.princess.example')
    expect(storage.m.get(REFRESH_KEY)).toBe('r2')
    const bad = make(() => reply(401), memory())
    bad.storage.setItem(REFRESH_KEY, 'stale')
    expect(await bad.auth.restore()).toBe(false)
    expect(bad.storage.m.has(REFRESH_KEY)).toBe(false)
    expect(await make(() => reply(200, session(1))).auth.restore()).toBe(false)
  })
  it('keeps the refresh token through a network failure', async () => {
    const storage = memory()
    storage.setItem(REFRESH_KEY, 'r1')
    const { auth } = make(() => reply(503), storage)
    expect(await auth.restore()).toBe(false)
    expect(storage.m.get(REFRESH_KEY)).toBe('r1')
  })
  it('signs out locally even when the server call fails, and revokes when it can', async () => {
    const { auth, storage, s } = make((c) => (c.url.endsWith('/logout') ? reply(204) : reply(200, session(1))))
    await auth.signIn({ method: 'password', identifier: 'a', password: 'b' })
    await auth.signOut()
    expect(s.calls.at(-1)).toMatchObject({ url: '/api/v1/auth/logout', auth: 'Bearer a1' })
    expect(JSON.parse(s.calls.at(-1)!.body!)).toEqual({ refreshToken: 'r1' })
    expect(auth.current()).toBeNull()
    expect(auth.accessToken()).toBeNull()
    expect(storage.m.has(REFRESH_KEY)).toBe(false)
    const down = make(() => reply(200, session(1)))
    await down.auth.signIn({ method: 'password', identifier: 'a', password: 'b' })
    down.s.calls.length = 0
    await expect(down.auth.signOut()).resolves.toBeUndefined()
    expect(down.auth.current()).toBeNull()
  })

  it('signs out everywhere through the server, and stays signed in when it cannot', async () => {
    const ok = make((c) => (c.url.endsWith('/logout-all') ? reply(204) : reply(200, session(1))))
    await ok.auth.signIn({ method: 'password', identifier: 'a', password: 'b' })
    await ok.auth.account!.signOutEverywhere()
    expect(ok.s.calls.at(-1)).toMatchObject({ url: '/api/v1/auth/logout-all', auth: 'Bearer a1' })
    expect(ok.auth.current()).toBeNull()
    expect(ok.storage.m.has(REFRESH_KEY)).toBe(false)
    const down = make((c) => (c.url.endsWith('/logout-all') ? reply(503) : reply(200, session(1))))
    await down.auth.signIn({ method: 'password', identifier: 'a', password: 'b' })
    await expect(down.auth.account!.signOutEverywhere()).rejects.toBeDefined()
    expect(down.auth.current()).not.toBeNull()
  })

  it('lists devices with this tab\'s refresh token and signs one out by id', async () => {
    const devices = [{ id: '7', device: 'Safari on iPhone', signedInAt: 1, lastActiveAt: 2, current: true }, { id: '9', device: 'Edge on Windows', signedInAt: 1, lastActiveAt: 1, current: false }]
    const a = make((c) => (c.url.endsWith('/sessions/list') ? reply(200, devices) : c.method === 'DELETE' ? reply(204) : reply(200, session(1))))
    await a.auth.signIn({ method: 'password', identifier: 'a', password: 'b' })
    expect(await a.auth.account!.listDevices()).toEqual(devices)
    expect(a.s.calls.at(-1)).toMatchObject({ url: '/api/v1/auth/sessions/list', method: 'POST', body: '{"refreshToken":"r1"}' })
    await a.auth.account!.signOutDevice('9')
    expect(a.s.calls.at(-1)).toMatchObject({ url: '/api/v1/auth/sessions/9', method: 'DELETE' })
    expect(a.auth.current()).not.toBeNull()
    const down = make((c) => (c.url.endsWith('/sessions/list') ? reply(503) : reply(200, session(1))))
    await down.auth.signIn({ method: 'password', identifier: 'a', password: 'b' })
    await expect(down.auth.account!.listDevices()).rejects.toBeDefined()
  })

  describe('sign-up and recovery', () => {
    it('registers and signs in, trimming the email', async () => {
      const { auth, s, storage } = make(() => reply(200, session(1, 'new@example.com')))
      const got = await auth.account!.register({ email: ' new@example.com ', password: 'a-long-password', firstName: 'N', lastName: 'G', dob: '1990-01-01' })
      expect(got.user?.email).toBe('new@example.com')
      expect(s.calls[0]).toMatchObject({ url: '/api/v1/auth/register', auth: null })
      expect(JSON.parse(s.calls[0].body!).email).toBe('new@example.com')
      expect(storage.m.get(REFRESH_KEY)).toBe('r1')
    })
    it('sends confirmedDifferent and keeps the review flag', async () => {
      const { auth, s } = make(() => reply(200, { ...session(1), user: { ...user('n@b.co'), needsReview: true } }))
      const got = await auth.account!.register({ email: 'n@b.co', password: 'a-long-password', firstName: 'N', lastName: 'G', dob: '1990-01-01', confirmedDifferent: true })
      expect(JSON.parse(s.calls.at(-1)!.body!)).toMatchObject({ confirmedDifferent: true })
      expect(got.user?.needsReview).toBe(true)
    })
    it('maps the named failures', async () => {
      const input = { email: 'a@b.co', password: 'a-long-password', firstName: 'N', lastName: 'G', dob: '1990-01-01' }
      await expect(make(() => reply(409, { title: 'emailTaken' })).auth.account!.register(input)).rejects.toMatchObject({ code: 'emailTaken' })
      await expect(make(() => reply(409, { title: 'possibleDuplicate' })).auth.account!.register(input)).rejects.toMatchObject({ code: 'possibleDuplicate' })
      await expect(make(() => reply(400, { title: 'tooYoung' })).auth.account!.register(input)).rejects.toMatchObject({ code: 'tooYoung' })
      await expect(make(() => reply(400, { title: 'badCode' })).auth.account!.resetPassword('a@b.co', '123456', 'a-long-password')).rejects.toMatchObject({ code: 'badCode' })
      await expect(make(() => reply(503)).auth.account!.requestCode('reset', 'a@b.co')).rejects.toMatchObject({ code: 'unavailable' })
    })
    it('asks for each kind of code on its own route and sends the reset', async () => {
      const { auth, s } = make(() => reply(204))
      await auth.account!.requestCode('reset', ' a@b.co ')
      await auth.account!.requestCode('magic', 'a@b.co')
      await auth.account!.resetPassword('a@b.co', ' 123456 ', 'a-long-password')
      expect(s.calls.map((c) => c.url)).toEqual(['/api/v1/auth/forgot', '/api/v1/auth/magic', '/api/v1/auth/reset'])
      expect(JSON.parse(s.calls[0].body!)).toEqual({ email: 'a@b.co' })
      expect(JSON.parse(s.calls[2].body!)).toEqual({ email: 'a@b.co', code: '123456', newPassword: 'a-long-password' })
    })
    it('signs in with an emailed code', async () => {
      const { auth, s } = make(() => reply(200, session(1)))
      const got = await auth.signIn({ method: 'code', email: 'maya@demo.princess.example', code: '123456' })
      expect(got).toMatchObject({ method: 'code' })
      expect(s.calls[0].url).toBe('/api/v1/auth/magic/redeem')
      await expect(make(() => reply(400, { title: 'badCode' })).auth.signIn({ method: 'code', email: 'a@b.co', code: '000000' })).rejects.toMatchObject({ code: 'badCode' })
    })
  })
})
