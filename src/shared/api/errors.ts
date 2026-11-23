/** Why an API call failed. Screens decide wording from the code; `retryable` says whether trying again can help. */
export type ApiErrorCode = 'offline' | 'network' | 'timeout' | 'server' | 'notFound' | 'conflict' | 'forbidden' | 'invalid' | 'challenge' | 'declined'

const RETRYABLE: ReadonlySet<ApiErrorCode> = new Set(['offline', 'network', 'timeout', 'server', 'notFound'])

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly retryable: boolean
  /** The server's reference for this failure (its trace id), shown to the guest as secondary detail for support; absent for failures that never reached the server. */
  readonly reference?: string
  constructor(code: ApiErrorCode, message: string = code, reference?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.retryable = RETRYABLE.has(code)
    if (reference) this.reference = reference
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError
