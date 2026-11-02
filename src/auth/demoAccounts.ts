import type { Http } from '../api/http'

export interface DemoAccount { email: string; name: string; role: string }

/** The server's list of seeded demo accounts (`GET /auth/demo-accounts`; the server refuses in production). Anything unreadable is dropped. */
export function normalizeDemoAccounts(raw: unknown): DemoAccount[] {
  if (!Array.isArray(raw)) return []
  const out: DemoAccount[] = []
  for (const r of raw) {
    const o = r && typeof r === 'object' ? (r as Record<string, unknown>) : null
    if (!o || typeof o.email !== 'string' || o.email === '') continue
    const name = [o.firstName, o.lastName].filter((x): x is string => typeof x === 'string' && x !== '').join(' ')
    out.push({ email: o.email, name: name || o.email, role: typeof o.role === 'string' ? o.role : '' })
  }
  return out
}

export const fetchDemoAccounts = async (http: Http): Promise<DemoAccount[]> => normalizeDemoAccounts(await http.get<unknown>('/auth/demo-accounts', { anonymous: true }))
