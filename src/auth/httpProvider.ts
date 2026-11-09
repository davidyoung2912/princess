import type { Channel } from '../data/sync'
import { createHttp, type Http } from '../api/http'
import { isApiError } from '../api/errors'
import { AuthError, type AuthMethod, type AuthProvider, type Credentials, type Session, type SessionUser } from './provider'

/** Per-tab storage for the refresh token (see the token decision in docs/backend-plan.md, Phase 12). */
export const REFRESH_KEY = 'princess:refresh'

type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface HttpAuthOptions {
  baseUrl: string
  /** Per-tab storage for the refresh token. The access token never leaves memory. */
  storage: KeyValue | null
  fetch?: typeof fetch
  now?: () => number
  channel?: Channel
  timeoutMs?: number
}

interface WireUser {
  id: string; accountNumber: string; email: string | null; firstName: string | null; lastName: string | null; role: string; tier: string; isDemo: boolean; needsReview?: boolean
}
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

  const notify = () => listeners.forEach((l) => l())
  const store = (refreshToken: string | null) => {
    try {
      if (refreshToken) opts.storage?.setItem(REFRESH_KEY, refreshToken)
      else opts.storage?.removeItem(REFRESH_KEY)
    } catch { /* storage blocked: the session works until the page closes */ }
  }
  const take = (w: WireSession, method: AuthMethod = 'password'): Session => {
    access = w.accessToken
    store(w.refreshToken)
    const user: SessionUser = { id: w.user.id, accountNumber: w.user.accountNumber, email: w.user.email, firstName: w.user.firstName, lastName: w.user.lastName, role: w.user.role, tier: w.user.tier, isDemo: w.user.isDemo, ...(w.user.needsReview ? { needsReview: true } : {}) }
    current = { signedInAt: now(), method, user }
    return current
  }
  const clear = () => {
    access = null
    current = null
    store(null)
  }

  const raw = createHttp({ baseUrl: opts.baseUrl, fetch: opts.fetch, timeoutMs: opts.timeoutMs, token: () => access, refresh: () => restore(), onSignedOut: () => { clear(); notify(); opts.channel?.post({ type: 'session' }) } })

  let restoring: Promise<boolean> | null = null
  const restore = (): Promise<boolean> => (restoring ??= (async () => {
    let token: string | null = null
    try { token = opts.storage?.getItem(REFRESH_KEY) ?? null } catch { /* none */ }
    if (!token) return current !== null
    try {
      take(await raw.post<WireSession>('/auth/refresh', { refreshToken: token }, { anonymous: true }))
      notify()
      return true
    } catch (e) {
      // A refused token is over for good; a network failure keeps it for the next try.
      if (isApiError(e) && !e.retryable) { clear(); notify() }
      return false
    }
  })().finally(() => { restoring = null }))

  /** Maps a failed call to an AuthError: the server's named reasons first, then network trouble, then `fallback`. */
  const failure = (e: unknown, fallback: AuthError['code'] = 'invalid'): unknown => {
    if (!isApiError(e)) return e
    if (e.code === 'offline') return new AuthError('offline')
    if (e.retryable) return new AuthError('unavailable')
    const named: AuthError['code'][] = ['emailTaken', 'tooYoung', 'badCode', 'possibleDuplicate']
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
          const session = take(await raw.post<WireSession>('/auth/register', { ...input, email: input.email.trim() }, { anonymous: true }))
          notify()
          opts.channel?.post({ type: 'session' })
          return session
        } catch (e) { throw failure(e) }
      },
      async requestCode(purpose, email) {
        try { await raw.post(purpose === 'reset' ? '/auth/forgot' : '/auth/magic', { email: email.trim() }, { anonymous: true }) } catch (e) { throw failure(e) }
      },
      async resetPassword(email, code, newPassword) {
        try { await raw.post('/auth/reset', { email: email.trim(), code: code.trim(), newPassword }, { anonymous: true }) } catch (e) { throw failure(e) }
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
        const session = c.method === 'code'
          ? take(await raw.post<WireSession>('/auth/magic/redeem', { email: c.email.trim(), code: c.code.trim() }, { anonymous: true }), 'code')
          : take(await raw.post<WireSession>('/auth/login', { identifier: c.identifier.trim(), password: c.password }, { anonymous: true }))
        notify()
        opts.channel?.post({ type: 'session' })
        return session
      } catch (e) {
        throw failure(e, c.method === 'code' ? 'badCode' : 'badCredentials')
      }
    },
    async signOut() {
      const refreshToken = (() => { try { return opts.storage?.getItem(REFRESH_KEY) ?? null } catch { return null } })()
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
