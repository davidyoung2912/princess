import type { PersonaId } from '../domain/personas'

/** A signed-in person. Real providers would add tokens; the mock has none, so there is nothing secret to leak. */
export interface Session {
  personaId: PersonaId
  signedInAt: number
  method: AuthMethod
}

export type AuthMethod = 'demo'

/** Ways to sign in. Only the demo picker exists; passkeys, email links and the rest plug in here later (ACT-01). */
export type Credentials = { method: 'demo'; personaId: string }

export class AuthError extends Error {
  readonly code: 'unknownIdentity' | 'unsupportedMethod'
  constructor(code: 'unknownIdentity' | 'unsupportedMethod') {
    super(code)
    this.code = code
    this.name = 'AuthError'
  }
}

/** What screens and the API layer depend on; the mock below is one implementation. */
export interface AuthProvider {
  readonly id: string
  readonly methods: readonly AuthMethod[]
  /** The people the demo can sign in as. A real provider returns none. */
  identities(): readonly PersonaId[]
  current(): Session | null
  signIn(credentials: Credentials): Promise<Session>
  signOut(): Promise<void>
  subscribe(listener: () => void): () => void
}
