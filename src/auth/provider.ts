import type { PersonaId } from '../domain/people'

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

/** A signed-in person. */
export interface Session {
  signedInAt: number
  method: AuthMethod
  user?: SessionUser
}

/** The id the stores key a person's device copy by: their server user id (null when signed out). */
export const ownerIdOf = (session: Pick<Session, 'user'> | null | undefined): string | null => session?.user?.id ?? null

export type AuthMethod = 'password' | 'code'

/** Ways to sign in. `password` takes an email (the server can be switched to accept the 10-digit account number too) (ACT-01). */
export type Credentials =
  | { method: 'password'; identifier: string; password: string }
  /** The one-time code emailed after `requestCode('magic', email)`. */
  | { method: 'code'; email: string; code: string }

export type AuthErrorCode = 'unknownIdentity' | 'unsupportedMethod' | 'badCredentials' | 'unavailable' | 'offline' | 'emailTaken' | 'tooYoung' | 'badCode' | 'invalid'

/** What a new account needs. `dob` is "YYYY-MM-DD"; the account holder must be an adult. */
export interface Registration { email: string; password: string; firstName: string; lastName: string; dob: string }

export type CodePurpose = 'reset' | 'magic'

/** Sign-up and recovery (ACT-01). Only the real provider has them; the demo picker has no accounts to create or recover. */
export interface AccountActions {
  register(input: Registration): Promise<Session>
  /** Asks for a one-time code by email. Completes the same way whether or not the address has an account. */
  requestCode(purpose: CodePurpose, email: string): Promise<void>
  resetPassword(email: string, code: string, newPassword: string): Promise<void>
}

export class AuthError extends Error {
  readonly code: AuthErrorCode
  constructor(code: AuthErrorCode) {
    super(code)
    this.code = code
    this.name = 'AuthError'
  }
}

/** What screens and the API layer depend on. */
export interface AuthProvider {
  readonly id: string
  readonly methods: readonly AuthMethod[]
  /** Present on the real provider only. */
  readonly account?: AccountActions
  /** The people the demo can sign in as. The real provider returns none. */
  identities(): readonly PersonaId[]
  current(): Session | null
  signIn(credentials: Credentials): Promise<Session>
  signOut(): Promise<void>
  /** The access token for API calls, or null when signed out . */
  accessToken(): string | null
  /** Try to get a new access token from the stored refresh token (page load, or after a 401). True when signed in afterwards. */
  restore(): Promise<boolean>
  subscribe(listener: () => void): () => void
}
