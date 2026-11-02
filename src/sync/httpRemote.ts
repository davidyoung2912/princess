import type { Http } from '../api/http'
import type { Remote } from './sync'

interface StateDto { key: string; version: number; data: unknown; updatedAt: number }

/** The account-state routes (`/me/state/{key}`) as a `Remote`. */
export const createHttpRemote = (http: Http): Remote => ({
  get: async (key) => {
    const doc = await http.get<StateDto | null>(`/me/state/${encodeURIComponent(key)}`)
    return doc ? { version: doc.version, data: doc.data } : null
  },
  put: async (key, data, baseVersion) => {
    const doc = await http.put<StateDto>(`/me/state/${encodeURIComponent(key)}`, { data, baseVersion })
    return { version: doc.version, data: doc.data }
  },
})
