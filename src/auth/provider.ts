import type { PersonaId } from '../domain/personas'

/** The person the server says is signed in (the `/me` shape, trimmed to what screens use). Tokens are never part of a Session. */
export interface SessionUser {
  id: string
  accountNumber: string
  email: string | null
  firstName: string | null
  lastName: string | null
  role: string
  tier: string
  isDemo: boolean
}

/**
 * A signed-in person. `personaId` is the demo persona this account maps to (the mock data layer is keyed by it until
 * the screens move to the real API in Phases 13 to 18); it is null for an account that is not one of the twelve.
 */
export interface Session {
  personaId: PersonaId | null
  signedInAt: number
  method: AuthMethod
  user?: SessionUser
}

export type AuthMethod = 'demo' | 'password'

/** Ways to sign in. The demo picker is the mock's; `password` takes an email or 10-digit account number (ACT-01). */
export type Credentials = { method: 'demo'; personaId: string } | { method: 'password'; identifier: string; password: string }

export type AuthErrorCode = 'unknownIdentity' | 'unsupportedMethod' | 'badCredentials' | 'unavailable' | 'offline'

export class AuthError extends Error {
  readonly code: AuthErrorCode
  constructor(code: AuthErrorCode) {
    super(code)
    this.code = code
    this.name = 'AuthError'
  }
}

/** What screens and the API layer depend on; the mock below is one implementation. */
export interface AuthProvider {
  readonly id: string
  readonly methods: readonly AuthMethod[]
  /** The people the demo can sign in as. The real provider returns none. */
  identities(): readonly PersonaId[]
  current(): Session | null
  signIn(credentials: Credentials): Promise<Session>
  signOut(): Promise<void>
  /** The access token for API calls, or null when signed out or when the provider has none (the mock). */
  accessToken(): string | null
  /** Try to get a new access token from the stored refresh token (page load, or after a 401). True when signed in afterwards. */
  restore(): Promise<boolean>
  subscribe(listener: () => void): () => void
}
