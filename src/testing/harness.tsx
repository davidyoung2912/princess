// Test support only (nothing in the app imports src/testing). Renders the real app, in jsdom, against a stubbed network: the real API client, guards, stores and
// screens run, and only `fetch` is replaced by a table of fixture answers. A path with no fixture answers 404 and is recorded, so a test can say what a screen asked for.
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { AppRoutes } from '../App'
import { auth, startRuntime } from '../runtime'
import { markReferenceAllReady } from '../domain/referenceStatus'
import { SCREENS } from '../screens'

export type Answer = unknown | ((url: URL, init?: RequestInit) => unknown)
export type Fixtures = Record<string, Answer>

export interface Net { calls: string[]; misses: string[]; fixtures: Fixtures; offline: boolean }

/** Replaces `fetch` with the fixture table. Keys are paths after `/api/v1` (query ignored), a trailing `*` matches a prefix; `GET ` or `POST ` before the path limits the method. */
export function stubNetwork(fixtures: Fixtures): Net {
  const net: Net = { calls: [], misses: [], fixtures, offline: false }
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.pathname.replace(/^\/api\/v1/, '')
    net.calls.push(`${method} ${path}`)
    if (net.offline) throw new TypeError('network down')
    const keys = Object.keys(net.fixtures)
    const key = keys.find((k) => k === `${method} ${path}` || k === path) ?? keys.find((k) => k.endsWith('*') && `${method} ${path}`.startsWith(k.replace(/\*$/, '')) || k.endsWith('*') && path.startsWith(k.replace(/^[A-Z]+ /, '').replace(/\*$/, '')))
    if (key === undefined) {
      net.misses.push(`${method} ${path}`)
      return new Response(JSON.stringify({ title: 'no fixture' }), { status: 404, headers: { 'content-type': 'application/json' } })
    }
    const a = net.fixtures[key]
    const body = typeof a === 'function' ? (a as (u: URL, i?: RequestInit) => unknown)(url, init) : a
    if (body instanceof Response) return body
    return new Response(body === undefined ? null : JSON.stringify(body), { status: body === undefined ? 204 : 200, headers: { 'content-type': 'application/json' } })
  })
  return net
}

/** Signs in through the stubbed `/auth/login` and starts the runtime, so the person's context and account state load as they do in the app. */
export async function signInAs(): Promise<void> {
  await startRuntime()
  // The reference tables are seeded by `setup.ts`; a failed fetch of them (no fixture) must not put the waiting page over the screen.
  markReferenceAllReady()
  await auth.signIn({ method: 'password', identifier: 'tester', password: 'x' })
  // The context is fetched after the sign-in event; wait until the person is known.
  const { getContext } = await import('../account/context')
  await waitFor(() => { if (!getContext()) throw new Error('no context yet') })
}

/** Renders the app at a path. Screens load lazily, so preload them all first (as the render test does). */
export async function renderAt(path: string) {
  await Promise.all(Object.values(SCREENS).map((s) => ('preload' in s ? s.preload() : null)))
  let view!: ReturnType<typeof render>
  await act(async () => {
    view = render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>)
  })
  return view
}

export function teardown(): void {
  cleanup()
  vi.unstubAllGlobals()
  try { localStorage.clear(); sessionStorage.clear() } catch { /* none */ }
}
