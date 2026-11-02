import { createHttpGroups, withHttpGroups } from '../api/httpApi'
import { createMockApi } from '../api/mock'
import type { Api } from '../api/types'
import type { ConciergeSender } from '../ai/concierge'
import { createHttpAuthProvider } from '../auth/httpProvider'
import { createMockAuthProvider } from '../auth/mockProvider'
import { ownerIdOf, type AuthProvider } from '../auth/provider'
import { deleteDatabase, openStore } from '../data/idbStore'
import { resetDemo, wipeEverything } from '../data/lifecycle'
import type { DataRecord, DataStore } from '../data/store'
import { setDemoRemote } from '../demo/publish'
import { flushTelemetry, setTelemetrySender } from '../diagnostics/watch'
import { getDemo, pullDemoFromServer, resetDemoState, watchOtherTabs } from '../demo/store'
import { foundFeed, loungerFeed, openingFeed, sightingsFeed } from '../feeds/onboard'
import { pulseFeed } from '../feeds/pulse'
import { skyNightFeed } from '../feeds/skyNight'
import { stormFeed } from '../feeds/storm'
import { forgetCrowd, setCrowdFetcher } from '../feeds/portCrowd'
import { forgetFares, setFaresFetcher } from '../feeds/fares'
import { forgetFlights, setFlightFetcher } from '../feeds/flight'
import { forgetConditions, setRouteFetcher } from '../feeds/route'
import { forgetSky, setSkyFetcher } from '../feeds/sky'
import { normalizeAccessReference, setServedAccess } from '../domain/accessReference'
import { normalizeRates, type RateTable } from '../domain/rates'
import { DEFAULT_PERSONA, personaById } from '../domain/personas'
import { resetSettingsToDefaults, switchSettingsOwner } from '../settings/store'
import { sync, setRemote } from '../sync'
import { registerSyncBindings } from '../sync/bindings'
import { createHttpRemote } from '../sync/httpRemote'
import { createHttpPortRows } from '../sync/httpPortRows'
import { portRows, setPortRowsRemote } from '../sync/portRows'
import { channel } from './channel'

const safe = (get: () => Storage): Storage | null => {
  try { return typeof window === 'undefined' ? null : get() } catch { return null }
}
const local = () => safe(() => localStorage)
const session = () => safe(() => sessionStorage)

let opening: Promise<DataStore> | null = null
/** The database, opened on first use. */
export const getStore = (): Promise<DataStore> => (opening ??= openStore())

/** A DataStore that opens the database on its first call, so the mock API can be built before anything is opened. */
const lazyStore: DataStore = {
  get: async (k, o, i) => (await getStore()).get(k, o, i),
  put: async (r: DataRecord) => (await getStore()).put(r),
  delete: async (k, o, i) => (await getStore()).delete(k, o, i),
  list: async (k, o) => (await getStore()).list(k, o),
  all: async (o) => (await getStore()).all(o),
  clear: async () => (await getStore()).clear(),
  getMeta: async (k) => (await getStore()).getMeta(k),
  setMeta: async (k, v) => (await getStore()).setMeta(k, v),
  close: () => { void opening?.then((s) => s.close()) },
}

/** Set `VITE_API_URL` (for example `/api/v1`, served by the Vite proxy) to sign in against the real API; otherwise the demo picker is used. */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? ''
export const usesRealAuth = API_URL !== ''

export const auth: AuthProvider = usesRealAuth
  ? createHttpAuthProvider({ baseUrl: API_URL, storage: session(), channel })
  : createMockAuthProvider({ session: session(), local: local(), channel })

const mockApi: Api = createMockApi({
  store: lazyStore,
  demo: getDemo,
  persona: () => auth.current()?.personaId ?? null,
  channel,
})

/** With real sign-in, the account area (Phase 13), discover and booking (Phase 14), the pre-cruise groups (Phase 15), check-in and boarding (Phase 16) everything on board (Phase 17) and the after-cruise groups (Phase 18) are served by the REST API; only dining/queues/requests (legacy, dropped) stay on the mock. */
const rest = usesRealAuth ? createHttpGroups((auth as ReturnType<typeof createHttpAuthProvider>).http) : null
if (rest) auth.subscribe(rest.reset)
export const api: Api = rest ? withHttpGroups(mockApi, rest.groups) : mockApi

/** Today's rate table from the server, so every device shows the same one; null in mock mode (the hook then uses the local stub). */
export const fetchRates: (() => Promise<RateTable>) | null = rest
  ? async () => normalizeRates(await (auth as ReturnType<typeof createHttpAuthProvider>).http.get<unknown>('/rates'))
  : null

/** The concierge is answered by the server (model key, tools, guard and hourly limit stay there); null in mock mode, where the built-in helper answers on the device. */
export const sendConcierge: ConciergeSender | null = rest ? (body) => (auth as ReturnType<typeof createHttpAuthProvider>).http.post<unknown>('/me/concierge', body) : null

/** Asks guest services for a call back, a caregiver or a sensory kit; the server answers with the guest's place in the staff queue. Null in mock mode (the on-device pretend queue is used). */
export const staffRequest: ((kind: 'callback' | 'caregiver' | 'kit', reason?: string) => Promise<unknown>) | null = rest
  ? (kind, reason) => (auth as ReturnType<typeof createHttpAuthProvider>).http.post<unknown>('/me/staff-requests', { kind, reason })
  : null

/** Family-at-home links signed by the server (null in mock mode, where the device signs them): make, stop, stop all, send a postcard and open a link's page (no sign-in). */
export const familyHome: {
  issue: (days: number) => Promise<unknown>
  revoke: (id: string) => Promise<void>
  revokeAll: () => Promise<void>
  postcard: (kind: string, note: string) => Promise<void>
  view: (token: string) => Promise<unknown>
} | null = rest
  ? (() => {
      const http = (auth as ReturnType<typeof createHttpAuthProvider>).http
      return {
        issue: (days: number) => http.post<unknown>('/me/family-links', { days }),
        revoke: (id: string) => http.delete<void>(`/me/family-links/${encodeURIComponent(id)}`),
        revokeAll: () => http.delete<void>('/me/family-links'),
        postcard: (kind: string, note: string) => http.post<void>('/me/family-postcards', { kind, note }),
        view: (token: string) => http.get<unknown>(`/public/family/${encodeURIComponent(token)}`, { anonymous: true }),
      }
    })()
  : null

if (rest) {
  const http = (auth as ReturnType<typeof createHttpAuthProvider>).http
  setSkyFetcher((sailing, day, port) => http.get<unknown>('/feeds/sky', { query: { sailing, day, port } }))
  setFlightFetcher((number, date) => http.get<unknown>('/feeds/flight', { query: { number, date } }))
  auth.subscribe(forgetSky)
  // Consented reports go to the server's telemetry route (signed-in only; the queue waits otherwise).
  setTelemetrySender((items) => (auth.current() ? http.post('/telemetry', { items }) : Promise.reject(new Error('signed out'))))
  setRouteFetcher((departure, crowd) => http.get<unknown>('/feeds/route', { query: { departure, crowd } }))
  setCrowdFetcher((port, date) => http.get<unknown>('/feeds/port-crowd', { query: { port, date } }))
  setFaresFetcher((number, total, booked, today) => http.get<unknown>('/feeds/fares', { query: { number, total, booked, today } }))
  pulseFeed.setFetcher((departure, now) => http.get<unknown>('/feeds/pulse', { query: { departure, now } }))
  stormFeed.setFetcher((departure, days) => http.get<unknown>('/feeds/storm', { query: { departure, days } }))
  skyNightFeed.setFetcher((departure, day) => http.get<unknown>('/feeds/sky-night', { query: { departure, day } }))
  loungerFeed.setFetcher((minute) => http.get<unknown>('/feeds/loungers', { query: { now: minute * 60_000 } }))
  sightingsFeed.setFetcher((day) => http.get<unknown>('/feeds/sightings', { query: { day } }))
  foundFeed.setFetcher(() => http.get<unknown>('/feeds/found'))
  openingFeed.setFetcher((id, created, slot) => http.get<unknown>('/feeds/watch-opening', { query: { id, created, slot } }))
  for (const f of [pulseFeed, stormFeed, skyNightFeed, loungerFeed, sightingsFeed, foundFeed, openingFeed]) auth.subscribe(f.forget)
  auth.subscribe(forgetCrowd)
  auth.subscribe(forgetFares)
  auth.subscribe(forgetFlights)
  auth.subscribe(forgetConditions)
  // A demo account's controls (clock, scenarios) are sent to the server so its own "now" agrees, and a new device takes them back; real accounts send nothing.
  const demoOnly = <T,>(call: () => Promise<T>): Promise<T | undefined> => (auth.current()?.user?.isDemo ? call() : Promise.resolve(undefined))
  setDemoRemote({
    save: (payload) => demoOnly(() => http.put('/demo/state', payload)),
    jump: (at) => demoOnly(() => http.post('/demo/jump', { at })),
    reset: () => demoOnly(() => http.post('/demo/reset')),
    load: () => demoOnly(() => http.get<unknown>('/demo/state')).then((r) => r ?? null),
  })
}

/** Fetches the access reference data (excursion difficulty, accessible room types) once a person is signed in; failures leave the authored copies in use. */
function loadReference(): void {
  if (!usesRealAuth) return
  if (!auth.current()) { setServedAccess(null); return }
  void (auth as ReturnType<typeof createHttpAuthProvider>).http.get<unknown>('/reference/access')
    .then((raw) => setServedAccess(normalizeAccessReference(raw)))
    .catch(() => {})
}

/** Points the sync module at the signed-in person (or at nobody) and fetches their account state. Does nothing without the real API. */
function syncAccount(): void {
  if (!usesRealAuth) return
  loadReference()
  const session = auth.current()
  const http = (auth as ReturnType<typeof createHttpAuthProvider>).http
  setRemote(session ? createHttpRemote(http) : null)
  setPortRowsRemote(session ? createHttpPortRows(http) : null)
  if (sync.setOwner(session?.user?.id ?? null, ownerIdOf(session))) void sync.pull()
  if (portRows.setOwner(session?.user?.id ?? null, ownerIdOf(session))) void portRows.pull()
  if (session?.user?.isDemo) void pullDemoFromServer()
}

/** Account state is fetched again when the tab is shown or the connection returns, so a change made on another device appears. Returns the stop function. */
function watchDeviceReturn(): () => void {
  if (!usesRealAuth || typeof window === 'undefined') return () => {}
  const onOnline = () => { void sync.pull(); void portRows.pull(); void pullDemoFromServer(); void flushTelemetry() }
  const onVisible = () => { if (document.visibilityState === 'visible') { void sync.pull(); void portRows.pull(); void pullDemoFromServer() } else void flushTelemetry() }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
let stopWatchingDevice: () => void = () => {}

/** Start-up: sign in as the last person (or Gerald, the primary persona), use their settings, and listen to other tabs. Call once before first render. */
export async function startRuntime(): Promise<void> {
  watchOtherTabs()
  registerSyncBindings()
  stopWatchingDevice()
  stopWatchingDevice = watchDeviceReturn()
  auth.subscribe(() => {
    switchSettingsOwner(personaById(auth.current()?.personaId) ?? null, ownerIdOf(auth.current()))
    syncAccount()
  })
  if (usesRealAuth) {
    await auth.restore()
    switchSettingsOwner(personaById(auth.current()?.personaId) ?? null, ownerIdOf(auth.current()))
    syncAccount()
    return
  }
  if (!auth.current()) await auth.signIn({ method: 'demo', personaId: DEFAULT_PERSONA })
  else switchSettingsOwner(personaById(auth.current()!.personaId) ?? null, ownerIdOf(auth.current()))
}

/** Sign out after sending any change still waiting to reach the account, so nothing typed just before is lost (a failed send does not block signing out). */
export async function signOutSaving(): Promise<void> {
  if (usesRealAuth) await Promise.all([sync.flush().catch(() => {}), portRows.flush().catch(() => {})])
  await auth.signOut()
}

/** Settings, database and controls for "Reset demo". */
export async function resetDemoData(): Promise<void> {
  await resetDemo(lazyStore, local())
  resetDemoState()
  channel.post({ type: 'records' })
}

/** "Wipe everything": all saved data, settings and the sign-in; the page reloads to a clean first run. */
export async function wipeAll(): Promise<void> {
  const store = opening ? await opening.catch(() => null) : null
  opening = null
  await wipeEverything({ store, deleteDatabase, local: local(), session: session() })
  resetSettingsToDefaults()
  location.reload()
}
