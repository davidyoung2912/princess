import { PERSONAS, isPersonaId, type PersonaId } from '../domain/personas'
import type { Channel } from '../data/sync'
import { AuthError, type AuthProvider, type Credentials, type Session } from './provider'

export const SESSION_KEY = 'princess:session'
export const LAST_PERSONA_KEY = 'princess:lastPersona'

type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface MockAuthOptions {
  /** Per-tab storage: each tab can be a different person. */
  session: KeyValue | null
  /** Device storage: remembers who was last used so a new tab starts as them. */
  local: KeyValue | null
  now?: () => number
  channel?: Channel
}

/** The demo identity provider: any of the twelve people, no password, nothing stored but the persona id. */
export function createMockAuthProvider(opts: MockAuthOptions): AuthProvider {
  const now = opts.now ?? Date.now
  const listeners = new Set<() => void>()
  let current: Session | null = null

  const parse = (text: string | null | undefined): Session | null => {
    try {
      const o = text ? (JSON.parse(text) as Record<string, unknown>) : null
      return o && isPersonaId(o.personaId) && typeof o.signedInAt === 'number' ? { personaId: o.personaId, signedInAt: o.signedInAt, method: 'demo' } : null
    } catch {
      return null
    }
  }
  const read = (): Session | null => {
    const stored = parse(opts.session?.getItem(SESSION_KEY))
    if (stored) return stored
    const last = opts.local?.getItem(LAST_PERSONA_KEY)
    return isPersonaId(last) ? { personaId: last, signedInAt: now(), method: 'demo' } : null
  }
  current = read()
  const notify = () => listeners.forEach((l) => l())

  return {
    id: 'mock',
    methods: ['demo'],
    identities: () => PERSONAS.map((p) => p.id),
    current: () => current,
    async signIn(c: Credentials) {
      if (c.method !== 'demo') throw new AuthError('unsupportedMethod')
      if (!isPersonaId(c.personaId)) throw new AuthError('unknownIdentity')
      const session: Session = { personaId: c.personaId as PersonaId, signedInAt: now(), method: 'demo' }
      current = session
      try {
        opts.session?.setItem(SESSION_KEY, JSON.stringify(session))
        opts.local?.setItem(LAST_PERSONA_KEY, session.personaId)
      } catch { /* storage full or blocked: the session still works for this page */ }
      notify()
      opts.channel?.post({ type: 'session' })
      return session
    },
    async signOut() {
      current = null
      try {
        opts.session?.removeItem(SESSION_KEY)
        opts.local?.removeItem(LAST_PERSONA_KEY)
      } catch { /* nothing to clean */ }
      notify()
    },
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l) } },
  }
}
