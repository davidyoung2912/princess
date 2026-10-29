/** Why a mock API call failed. Screens decide wording from the code; `retryable` says whether trying again can help. */
export type ApiErrorCode = 'offline' | 'network' | 'timeout' | 'server' | 'notFound' | 'conflict' | 'forbidden' | 'invalid'

const RETRYABLE: ReadonlySet<ApiErrorCode> = new Set(['offline', 'network', 'timeout', 'server', 'notFound'])

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly retryable: boolean
  constructor(code: ApiErrorCode, message: string = code) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.retryable = RETRYABLE.has(code)
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError
