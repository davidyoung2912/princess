import type { Channel } from '../data/sync'
import { createHttp, type Http } from '../api/http'
import { isApiError } from '../api/errors'
import { AuthError, type AuthMethod, type DeviceSession, type ReviewItem, type AuthProvider, type Credentials, type Session, type SessionUser } from './provider'

/** Per-tab storage for the refresh token (see the token decision in docs/backend-plan.md, Phase 12). */
export const REFRESH_KEY = 'princess:refresh'

type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface HttpAuthOptions {
  baseUrl: string
  /** Per-tab storage for the refresh token. The access token never leaves memory. */
  storage: KeyValue | null
  /** Long-lived device storage for "Remember me": holds the refresh token so the next app start skips the sign-in page. */
  persistent?: KeyValue | null
  fetch?: typeof fetch
  now?: () => number
  channel?: Channel
  timeoutMs?: number
}

interface WireUser {
  id: string; accountNumber: string; username: string; email: string | null; firstName: string | null; lastName: string | null; role: string; tier: string; isDemo: boolean; needsReview?: boolean
}
/** Set when the server ended this device's session on purpose; the sign-in page reads and clears it. */
export const SESSION_ENDED = 'princess.sessionEnded'

interface WireSession { accessToken: string; expiresAt: number; refreshToken: string; refreshExpiresAt: number; user: WireUser }

/**
 * The real identity provider: email or account number plus password against `/auth/login`. The access token (15 minutes)
 * lives only in memory. The refresh token (30 days, single use) is kept in per-tab session storage, so a reload
 * restores the session and closing the tab ends it; an httpOnly cookie would need the API to set it and is a later option.
 */
export function createHttpAuthProvider(opts: HttpAuthOptions): AuthProvider & { http: Http } {
  const now = opts.now ?? Date.now
  const listeners = new Set<() => void>()
  let current: Session | null = null
  let access: string | null = null
  const readKey = (kv: KeyValue | null | undefined): string | null => { try { return kv?.getItem(REFRESH_KEY) ?? null } catch { return null } }
  /** True when this device was told to remember the sign-in (the token sits in device storage). */
  let remember = readKey(opts.persistent) !== null
  const storedToken = () => readKey(opts.storage) ?? readKey(opts.persistent)

  const notify = () => listeners.forEach((l) => l())
  const store = (refreshToken: string | null) => {
    try {
      if (refreshToken) opts.storage?.setItem(REFRESH_KEY, refreshToken)
      else opts.storage?.removeItem(REFRESH_KEY)
      if (refreshToken && remember) opts.persistent?.setItem(REFRESH_KEY, refreshToken)
      else opts.persistent?.removeItem(REFRESH_KEY)
    } catch { /* storage blocked: the session works until the page closes */ }
  }
  const take = (w: WireSession, method: AuthMethod = 'password'): Session => {
    access = w.accessToken
    store(w.refreshToken)
    const user: SessionUser = { id: w.user.id, accountNumber: w.user.accountNumber, username: w.user.username, email: w.user.email, firstName: w.user.firstName, lastName: w.user.lastName, role: w.user.role, tier: w.user.tier, isDemo: w.user.isDemo, ...(w.user.needsReview ? { needsReview: true } : {}) }
    current = { signedInAt: now(), method, user }
    return current
  }
  const clear = () => {
    remember = false
    access = null
    current = null
    store(null)
  }

  const raw = createHttp({ baseUrl: opts.baseUrl, fetch: opts.fetch, timeoutMs: opts.timeoutMs, token: () => access, refresh: () => restore(), onSignedOut: () => { clear(); notify(); opts.channel?.post({ type: 'session' }) } })

  let restoring: Promise<boolean> | null = null
  const restore = (): Promise<boolean> => (restoring ??= (async () => {
    const token = storedToken()
    if (!token) return current !== null
    try {
      take(await raw.post<WireSession>('/auth/refresh', { refreshToken: token }, { anonymous: true }))
      notify()
      return true
    } catch (e) {
      // A refused token is over for good; a network failure keeps it for the next try.
      if (isApiError(e) && !e.retryable) {
        // Ended on purpose (signed out elsewhere, or retired for a newer sign-in): the sign-in page says so once.
        if (e.message === 'sessionEnded') { try { sessionStorage.setItem(SESSION_ENDED, '1') } catch { /* storage blocked: no note */ } }
        clear(); notify()
      }
      return false
    }
  })().finally(() => { restoring = null }))

  /** Maps a failed call to an AuthError: the server's named reasons first, then network trouble, then `fallback`. */
  const failure = (e: unknown, fallback: AuthError['code'] = 'invalid'): unknown => {
    if (!isApiError(e)) return e
    if (e.code === 'offline') return new AuthError('offline')
    if (e.retryable) return new AuthError('unavailable')
    const named: AuthError['code'][] = ['usernameTaken', 'tooYoung', 'badCode', 'badPassword', 'possibleDuplicate']
    return new AuthError(named.find((n) => n === e.message) ?? fallback)
  }

  return {
    id: 'http',
    http: raw,
    methods: ['password', 'code'],
    identities: () => [],
    current: () => current,
    accessToken: () => access,
    restore,
    account: {
      async register(input) {
        try {
          // The account is made but nobody is signed in: the guest signs in on the sign-in page, with their details filled in.
          await raw.post<WireSession>('/auth/register', { ...input, username: input.username.trim(), email: input.email.trim() }, { anonymous: true })
        } catch (e) { throw failure(e) }
      },
      async requestCode(purpose, username) {
        try { await raw.post(purpose === 'reset' ? '/auth/forgot' : '/auth/magic', { username: username.trim() }, { anonymous: true }) } catch (e) { throw failure(e) }
      },
      async resetPassword(username, code, newPassword) {
        try { await raw.post('/auth/reset', { username: username.trim(), code: code.trim(), newPassword }, { anonymous: true }) } catch (e) { throw failure(e) }
      },
      async listDevices() {
        const token = storedToken()
        try { return await raw.post<DeviceSession[]>('/auth/sessions/list', { refreshToken: token }) } catch (e) { throw failure(e) }
      },
      async onlineNow() {
        try { return (await raw.get<{ count: number }>('/auth/sessions/online')).count } catch (e) { throw failure(e) }
      },
      async signOutDevice(id) {
        try { await raw.delete(`/auth/sessions/${encodeURIComponent(id)}`) } catch (e) { throw failure(e) }
      },
      async listReviews() {
        try { return await raw.get<ReviewItem[]>('/admin/reviews') } catch (e) { throw failure(e) }
      },
      async resolveReview(id, decision) {
        try { await raw.post(`/admin/reviews/${encodeURIComponent(id)}/resolve`, { decision }) } catch (e) { throw failure(e) }
      },
      async changeCredentials(input) {
        try { await raw.post('/auth/credentials', input) } catch (e) { throw failure(e) }
        // The server has ended every session, this one included.
        clear()
        notify()
        opts.channel?.post({ type: 'session' })
      },
      async signOutEverywhere() {
        try { await raw.post('/auth/logout-all', {}) } catch (e) { throw failure(e) }
        clear()
        notify()
        opts.channel?.post({ type: 'session' })
      },
    },
    async signIn(c: Credentials) {
      try {
        remember = c.remember === true
        const session = c.method === 'code'
          ? take(await raw.post<WireSession>('/auth/magic/redeem', { username: c.username.trim(), code: c.code.trim() }, { anonymous: true }), 'code')
          : take(await raw.post<WireSession>('/auth/login', { identifier: c.identifier.trim(), password: c.password }, { anonymous: true }))
        notify()
        opts.channel?.post({ type: 'session' })
        return session
      } catch (e) {
        throw failure(e, c.method === 'code' ? 'badCode' : 'badCredentials')
      }
    },
    async signOut() {
      const refreshToken = storedToken()
      const wasIn = access !== null
      try {
        if (wasIn && refreshToken) await raw.post('/auth/logout', { refreshToken })
      } catch { /* the server forgets it at expiry; signing out here must not fail */ }
      clear()
      notify()
      opts.channel?.post({ type: 'session' })
    },
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l) } },
  }
}
