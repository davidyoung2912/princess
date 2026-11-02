import { ApiError, type ApiErrorCode } from './errors'

/** The API prefix. In development the Vite proxy forwards it to the API, so it is same-origin. */
export const API_BASE = '/api/v1'

export interface HttpOptions {
  /** Origin plus prefix, e.g. `/api/v1` or `https://api.example.com/api/v1`. */
  baseUrl: string
  fetch?: typeof fetch
  /** The current access token, or null when signed out. */
  token: () => string | null
  /** Swap the refresh token for a new session. Resolves true when a new access token is now available. */
  refresh: () => Promise<boolean>
  /** Called when a refresh fails: the session is over. */
  onSignedOut?: () => void
  timeoutMs?: number
  online?: () => boolean
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  signal?: AbortSignal
  /** Do not attach the bearer token or try to refresh (sign-in and refresh themselves). */
  anonymous?: boolean
  /** Send these bytes as the body, with this content type, instead of JSON. */
  raw?: Blob
  /** Answer with the response body as bytes instead of JSON. */
  asBlob?: boolean
}

export interface Http {
  get<T>(path: string, o?: RequestOptions): Promise<T>
  post<T>(path: string, body?: unknown, o?: RequestOptions): Promise<T>
  put<T>(path: string, body?: unknown, o?: RequestOptions): Promise<T>
  patch<T>(path: string, body?: unknown, o?: RequestOptions): Promise<T>
  delete<T>(path: string, o?: RequestOptions): Promise<T>
  /** Sends a picture (or other file) as the body, with the blob's own type; the answer is JSON. */
  upload<T>(path: string, file: Blob, o?: RequestOptions): Promise<T>
  /** Fetches a file with the bearer token (an `<img>` tag cannot send one). */
  blob(path: string, o?: RequestOptions): Promise<Blob>
}

const STATUS_CODES: Record<number, ApiErrorCode> = { 400: 'invalid', 401: 'forbidden', 403: 'forbidden', 404: 'notFound', 409: 'conflict', 422: 'invalid', 402: 'declined' }

/** The server's problem details name a more specific code (`challenge`, `declined`, `conflict`...). Fall back on the status. */
export function errorFor(status: number, body: unknown): ApiError {
  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const named = typeof o.code === 'string' ? o.code : typeof o.title === 'string' ? o.title : undefined
  const known: readonly ApiErrorCode[] = ['offline', 'network', 'timeout', 'server', 'notFound', 'conflict', 'forbidden', 'invalid', 'challenge', 'declined']
  const code = known.find((k) => k === named) ?? STATUS_CODES[status] ?? (status >= 500 ? 'server' : 'invalid')
  return new ApiError(code, named ?? code)
}

/** A small fetch wrapper: bearer token, one silent refresh on 401, a timeout, and failures as `ApiError`. */
export function createHttp(opts: HttpOptions): Http {
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const timeoutMs = opts.timeoutMs ?? 15_000
  const online = opts.online ?? (() => (typeof navigator === 'undefined' || navigator.onLine !== false))
  let refreshing: Promise<boolean> | null = null

  const refreshOnce = () => (refreshing ??= opts.refresh().catch(() => false).finally(() => { refreshing = null }))

  const send = async (method: string, path: string, o: RequestOptions): Promise<Response> => {
    if (!online()) throw new ApiError('offline')
    const query = o.query ? Object.entries(o.query).filter(([, v]) => v !== undefined).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&') : ''
    const url = `${opts.baseUrl}${path}${query ? `?${query}` : ''}`
    const headers: Record<string, string> = { accept: o.asBlob ? '*/*' : 'application/json' }
    if (o.raw) headers['content-type'] = o.raw.type
    else if (o.body !== undefined) headers['content-type'] = 'application/json'
    const token = o.anonymous ? null : opts.token()
    if (token) headers.authorization = `Bearer ${token}`
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), timeoutMs)
    const onAbort = () => timeout.abort()
    o.signal?.addEventListener('abort', onAbort)
    try {
      return await doFetch(url, { method, headers, body: o.raw ?? (o.body === undefined ? undefined : JSON.stringify(o.body)), signal: timeout.signal })
    } catch {
      throw new ApiError(o.signal?.aborted ? 'network' : timeout.signal.aborted ? 'timeout' : 'network')
    } finally {
      clearTimeout(timer)
      o.signal?.removeEventListener('abort', onAbort)
    }
  }

  const request = async <T>(method: string, path: string, o: RequestOptions = {}): Promise<T> => {
    let res = await send(method, path, o)
    if (res.status === 401 && !o.anonymous) {
      if (await refreshOnce()) res = await send(method, path, o)
      else {
        opts.onSignedOut?.()
        throw new ApiError('forbidden', 'signedOut')
      }
    }
    if (o.asBlob && res.ok) return (await res.blob()) as T
    const text = res.status === 204 ? '' : await res.text().catch(() => '')
    let parsed: unknown = undefined
    if (text) {
      try { parsed = JSON.parse(text) } catch { /* not JSON: leave undefined */ }
    }
    if (!res.ok) throw errorFor(res.status, parsed)
    return parsed as T
  }

  return {
    get: (path, o) => request('GET', path, o),
    post: (path, body, o) => request('POST', path, { ...o, body }),
    put: (path, body, o) => request('PUT', path, { ...o, body }),
    patch: (path, body, o) => request('PATCH', path, { ...o, body }),
    delete: (path, o) => request('DELETE', path, o),
    upload: (path, file, o) => request('POST', path, { ...o, raw: file }),
    blob: (path, o) => request('GET', path, { ...o, asBlob: true }),
  }
}
