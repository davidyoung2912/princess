import { createHttpGroups, toApi } from '../api/httpApi'
import type { Api } from '../api/types'
import type { ConciergeSender } from '../ai/concierge'
import { createHttpAuthProvider } from '../auth/httpProvider'
import { ownerIdOf } from '../auth/provider'
import { resetDemo, wipeEverything } from '../data/lifecycle'
import { setDemoRemote } from '../demo/publish'
import { flushTelemetry, setTelemetrySender } from '../diagnostics/watch'
import { pullDemoFromServer, resetDemoState, watchOtherTabs } from '../demo/store'
import { foundFeed, loungerFeed, openingFeed, sightingsFeed } from '../feeds/onboard'
import { pulseFeed } from '../feeds/pulse'
import { skyNightFeed } from '../feeds/skyNight'
import { stormFeed } from '../feeds/storm'
import { crowdFeed } from '../feeds/portCrowd'
import { faresFeed } from '../feeds/fares'
import { flightFeed } from '../feeds/flight'
import { conditionsFeed } from '../feeds/route'
import { skyFeed } from '../feeds/sky'
import { markAccount, refreshContext, setContext } from '../account/context'
import { fromWire } from '../api/personaIds'
import { applyCatalogue, normalizeCatalogue } from '../domain/catalogueServed'
import { applySailings, normalizeSailings } from '../domain/sailingsServed'
import { applyShip, normalizeShip } from '../domain/shipServed'
import { applyProgram, normalizeProgram } from '../domain/programServed'
import { applyPorts, normalizePorts } from '../domain/portsServed'
import { applyPackages, normalizePackages } from '../domain/packagesServed'
import { applyLimits, normalizeLimits } from '../domain/limitsServed'
import { cacheGet, cachePut } from '../domain/offlineCache'
import { normalizeAccessReference, setServedAccess } from '../domain/accessReference'
import { normalizeRates, type RateTable } from '../domain/rates'
import { personaById } from '../domain/personas'
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

/** The server's address: `VITE_API_URL`, or `/api/v1` (the Vite proxy in development). There is no other mode; the server must be running. */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || '/api/v1'

export const auth = createHttpAuthProvider({ baseUrl: API_URL, storage: session(), channel })
const http = auth.http

const rest = createHttpGroups(http)
auth.subscribe(rest.reset)
export const api: Api = toApi(rest.groups)

/** Today's rate table from the server, so every device shows the same one. */
export const fetchRates = async (): Promise<RateTable> => normalizeRates(await http.get<unknown>('/rates'))

/** The concierge is answered by the server (model key, tools, guard and hourly limit stay there). */
export const sendConcierge: ConciergeSender = (body) => http.post<unknown>('/me/concierge', body)

/** Asks guest services for a call back, a caregiver or a sensory kit; the server answers with the guest's place in the staff queue. */
export const staffRequest = (kind: 'callback' | 'caregiver' | 'kit', reason?: string): Promise<unknown> => http.post<unknown>('/me/staff-requests', { kind, reason })

/** Family-at-home links signed by the server: make, stop, stop all, send a postcard and open a link's page (no sign-in). */
export const familyHome = {
  issue: (days: number) => http.post<unknown>('/me/family-links', { days }),
  revoke: (id: string) => http.delete<void>(`/me/family-links/${encodeURIComponent(id)}`),
  revokeAll: () => http.delete<void>('/me/family-links'),
  postcard: (kind: string, note: string) => http.post<void>('/me/family-postcards', { kind, note }),
  view: (token: string) => http.get<unknown>(`/public/family/${encodeURIComponent(token)}`, { anonymous: true }),
}

{
  skyFeed.setFetcher((sailing, day, port) => http.get<unknown>('/feeds/sky', { query: { sailing, day, port } }))
  flightFeed.setFetcher((number, date) => http.get<unknown>('/feeds/flight', { query: { number, date } }))
  // Consented reports go to the server's telemetry route (signed-in only; the queue waits otherwise).
  setTelemetrySender((items) => (auth.current() ? http.post('/telemetry', { items }) : Promise.reject(new Error('signed out'))))
  conditionsFeed.setFetcher((departure, crowd) => http.get<unknown>('/feeds/route', { query: { departure, crowd } }))
  crowdFeed.setFetcher((port, date) => http.get<unknown>('/feeds/port-crowd', { query: { port, date } }))
  faresFeed.setFetcher((number, total, booked, today) => http.get<unknown>('/feeds/fares', { query: { number, total, booked, today } }))
  pulseFeed.setFetcher((departure, now) => http.get<unknown>('/feeds/pulse', { query: { departure, now } }))
  stormFeed.setFetcher((departure, days) => http.get<unknown>('/feeds/storm', { query: { departure, days } }))
  skyNightFeed.setFetcher((departure, day) => http.get<unknown>('/feeds/sky-night', { query: { departure, day } }))
  loungerFeed.setFetcher((minute) => http.get<unknown>('/feeds/loungers', { query: { now: minute * 60_000 } }))
  sightingsFeed.setFetcher((day) => http.get<unknown>('/feeds/sightings', { query: { day } }))
  foundFeed.setFetcher(() => http.get<unknown>('/feeds/found'))
  openingFeed.setFetcher((id, created, slot) => http.get<unknown>('/feeds/watch-opening', { query: { id, created, slot } }))
  for (const f of [skyFeed, flightFeed, conditionsFeed, crowdFeed, faresFeed, pulseFeed, stormFeed, skyNightFeed, loungerFeed, sightingsFeed, foundFeed, openingFeed]) auth.subscribe(f.forget)
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
  if (!auth.current()) { setServedAccess(null); return }
  void http.get<unknown>('/reference/access')
    .then((raw) => setServedAccess(normalizeAccessReference(raw)))
    .catch(() => {})
}


/**
 * A served reference table (sailings, ship, programme, and the rest): public, so the copy kept on this device is applied at once, then the server's
 * answer if its `version` differs, and the raw answer is kept for next time. A missing, unreachable or malformed answer leaves what is in use.
 */
function loadTable<T extends { version: string }>(kind: string, path: string, normalize: (raw: unknown) => T | null, apply: (t: T) => void): void {
  const store = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }
  const kept = cacheGet(store(), kind, 'v1', normalize)
  if (kept) apply(kept.value)
  void http.get<unknown>(path, { anonymous: true })
    .then((raw) => {
      const fresh = normalize(raw)
      if (!fresh) return
      if (fresh.version !== kept?.value.version) apply(fresh)
      cachePut(store(), kind, 'v1', raw, Date.now())
    })
    .catch(() => {})
}
loadTable('catalogue', '/reference/catalogue', normalizeCatalogue, applyCatalogue)
loadTable('sailings', '/reference/sailings', normalizeSailings, applySailings)
loadTable('ship', '/reference/ship', normalizeShip, applyShip)
loadTable('program', '/reference/program', normalizeProgram, applyProgram)
loadTable('ports', '/reference/ports', normalizePorts, applyPorts)
loadTable('packages', '/reference/packages', normalizePackages, applyPackages)
loadTable('limits', '/reference/limits', normalizeLimits, applyLimits)

/** Points the sync module at the signed-in person (or at nobody) and fetches their account state. Does nothing without the real API. */
function syncAccount(): void {
  loadReference()
  const session = auth.current()
  loadContext()
  setRemote(session ? createHttpRemote(http) : null)
  setPortRowsRemote(session ? createHttpPortRows(http) : null)
  if (sync.setOwner(session?.user?.id ?? null, ownerIdOf(session))) void sync.pull()
  if (portRows.setOwner(session?.user?.id ?? null, ownerIdOf(session))) void portRows.pull()
  if (session?.user?.isDemo) void pullDemoFromServer()
}

/** Who is signed in, their trip, the sailing and the server's time (`GET /me/context`); cleared at sign-out. Nothing about it is kept on the device. */
let contextFor: string | undefined
function loadContext(): void {
  const session = auth.current()
  markAccount(session ? (session.user?.isDemo ?? null) : null)
  if (!session) { setContext(null); contextFor = undefined; return }
  const who = session.user?.id
  if (who !== contextFor) { setContext(null); contextFor = who }
  void refreshContext(async () => fromWire(await http.get<unknown>('/me/context')), () => auth.current()?.user?.id === who)
}

/** Account state is fetched again when the tab is shown or the connection returns, so a change made on another device appears. Returns the stop function. */
function watchDeviceReturn(): () => void {
  if (typeof window === 'undefined') return () => {}
  const onOnline = () => { loadContext(); void sync.pull(); void portRows.pull(); void pullDemoFromServer(); void flushTelemetry() }
  const onVisible = () => { if (document.visibilityState === 'visible') { loadContext(); void sync.pull(); void portRows.pull(); void pullDemoFromServer() } else void flushTelemetry() }
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
  await auth.restore()
  switchSettingsOwner(personaById(auth.current()?.personaId) ?? null, ownerIdOf(auth.current()))
  syncAccount()
}

/** Sign out after sending any change still waiting to reach the account, so nothing typed just before is lost (a failed send does not block signing out). */
export async function signOutSaving(): Promise<void> {
  await Promise.all([sync.flush().catch(() => {}), portRows.flush().catch(() => {})])
  await auth.signOut()
}

/** "Reset demo": the demo controls go back to first-run and the account's demo data is reset on the server. Display settings and who is signed in are kept. */
export async function resetDemoData(): Promise<void> {
  await resetDemo(local())
  resetDemoState()
}

/** "Wipe everything": every setting and the sign-in kept on this device; the page reloads to a clean first run. The account's data stays on the server. */
export async function wipeAll(): Promise<void> {
  wipeEverything({ local: local(), session: session() })
  resetSettingsToDefaults()
  location.reload()
}
