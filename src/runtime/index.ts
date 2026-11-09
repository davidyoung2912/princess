import { createHttpGroups, toApi } from '../api/httpApi'
import type { Api } from '../api/types'
import type { StanleySender } from '../ai/stanley'
import { createHttpAuthProvider } from '../auth/httpProvider'
import { ownerIdOf } from '../auth/provider'
import { OWNER_KEY, UNSENT_PREFIXES, clearPersonCopies, clearSavedScreens, resetDemo, sweepExpiredCopies, wipeEverything } from '../data/lifecycle'
import { setDemoRemote } from '../demo/publish'
import { flushTelemetry, setTelemetrySender } from '../diagnostics/watch'
import { pullDemoFromServer, resetDemoState, watchOtherTabs } from '../demo/store'
import { onDemoSent } from '../demo/publish'
import { startVisibleInterval } from '../hooks/visibleInterval'
import { foundFeed, loungerFeed, openingFeed, sightingsFeed } from '../feeds/onboard'
import { pulseDayFeed, pulseFeed } from '../feeds/pulse'
import { skyNightFeed } from '../feeds/skyNight'
import { alongFeed, positionFeed, seaFeed } from '../feeds/navigation'
import { weatherFeed } from '../feeds/weather'
import { nauticalFeed } from '../feeds/nautical'
import { stormFeed } from '../feeds/storm'
import { tenderFeed } from '../feeds/tender'
import { savedFacts } from '../feeds/stanleyFacts'
import { qualityFeed } from '../feeds/sailingQuality'
import { cabinGuideFeed } from '../feeds/cabinGuide'
import { embarkFeed } from '../feeds/embark'
import { friendReplyFeed } from '../feeds/friend'
import { crowdFeed } from '../feeds/portCrowd'
import { faresFeed } from '../feeds/fares'
import { flightFeed } from '../feeds/flight'
import { conditionsFeed } from '../feeds/route'
import { skyFeed } from '../feeds/sky'
import { weekFeed } from '../feeds/week'
import { dayPlanFeed } from '../feeds/dayPlan'
import { trialDayFeed } from '../feeds/trialDay'
import { markAccount, refreshContext, setContext } from '../account/context'
import { applyCatalogue, normalizeCatalogue } from '../domain/catalogueServed'
import { applySailings, normalizeSailings } from '../domain/sailingsServed'
import { setRoomLoaders } from '../domain/shipRooms'
import { setPlanLoader } from '../domain/aboardPlans'
import { setVenueLoader } from '../domain/shipVenues'
import { applyCataloguePorts, applyPatterns, applyRegions, applyShips, normalizeCataloguePorts, normalizePatterns, normalizeRegions, normalizeShips, setItineraryLoader } from '../domain/shipCatalogue'
import { applyShip, normalizeShip } from '../domain/shipServed'
import { applyProgram, normalizeProgram, setProgramLoader } from '../domain/programServed'
import { applyPorts, normalizePorts } from '../domain/portsServed'
import { applyPackages, normalizePackages } from '../domain/packagesServed'
import { applyPricing, normalizePricing } from '../domain/pricingServed'
import { applyLimits, normalizeLimits } from '../domain/limitsServed'
import { applyEntry, normalizeEntry } from '../domain/prepareDelights'
import { applyContent, normalizeContent } from '../domain/contentServed'
import { markReferenceFailed, markReferenceReady, markReferenceRetry, requireReference } from '../domain/referenceStatus'
import { cacheGet, cachePut } from '../domain/offlineCache'
import { normalizeAccessReference, setServedAccess } from '../domain/accessReference'
import { normalizeRates, type RateTable } from '../domain/rates'
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

export const auth = createHttpAuthProvider({ baseUrl: API_URL, storage: session(), persistent: local(), channel })
const http = auth.http

const rest = createHttpGroups(http)
auth.subscribe(rest.reset)
export const api: Api = toApi(rest.groups)

/** Today's rate table from the server, so every device shows the same one. */
export const fetchRates = async (): Promise<RateTable> => normalizeRates(await http.get<unknown>('/rates'))

/** Stanley, the one chat helper, is answered by the server's gateway (word filter, safety screen, routing, model, tools, budget and log all stay there). */
export const sendStanley: StanleySender = (body) => http.post<unknown>('/me/stanley', body)

/**
 * Stanley's actions (phase 5). The server prepares a preview with the reply; the device confirms it with an idempotency key, asks how it stands, undoes it within two hours and lists the receipts.
 * Nothing changes on the server without a confirm for a preview the server itself made.
 */
export const stanleyActions = {
  confirm: (id: string, key: string, context?: unknown) => http.post<unknown>(`/me/stanley/actions/${encodeURIComponent(id)}/confirm`, { key, context }),
  get: (id: string) => http.get<unknown>(`/me/stanley/actions/${encodeURIComponent(id)}`),
  undo: (id: string, context?: unknown) => http.post<unknown>(`/me/stanley/actions/${encodeURIComponent(id)}/undo`, { context }),
  receipts: () => http.get<unknown>('/me/stanley/receipts'),
}

/** Human handoff (phase 6): the server opens a case and answers with its reference, owner and status; the device lists them to show progress. */
export const stanleyHandoffs = {
  create: (body: unknown) => http.post<unknown>('/me/stanley/handoffs', body),
  list: () => http.get<unknown>('/me/stanley/handoffs'),
}

/** What Stanley remembers (phase 7): the guest's own preferences, kept by the server so every device shows the same list. Forgetting deletes the row. */
export const stanleyMemory = {
  get: () => http.get<unknown>('/me/stanley/memory'),
  remember: (body: unknown) => http.put<unknown>('/me/stanley/memory/items', body),
  update: (id: string, body: unknown) => http.patch<unknown>(`/me/stanley/memory/items/${encodeURIComponent(id)}`, body),
  forget: (id: string) => http.delete<void>(`/me/stanley/memory/items/${encodeURIComponent(id)}`),
  forgetAll: () => http.delete<void>('/me/stanley/memory'),
  setEnabled: (enabled: boolean) => http.put<void>('/me/stanley/memory/settings', { enabled }),
}

/** Dream and Discover (phase 8): the server reads a wish into filters, finds directions and compares sailings with the guest's weights; the brief is the guest's own, kept so every device resumes it. No sign-in is needed for the first four. */
export const stanleyDiscover = {
  interview: (text: string) => http.post<unknown>('/stanley/discover/interview', { text }),
  directions: (filters: unknown) => http.post<unknown>('/stanley/discover/directions', { filters }),
  compare: (sailingIds: string[], weights: unknown, filters: unknown) => http.post<unknown>('/stanley/discover/compare', { sailingIds, weights, filters }),
  bookingCheck: (body: { firstName: string; lastName: string; birthDate: string; departure: string }) => http.post<unknown>('/stanley/discover/booking-check', body),
  getBrief: () => http.get<unknown>('/me/stanley/discover/brief'),
  saveBrief: (brief: unknown) => http.put<unknown>('/me/stanley/discover/brief', brief),
  deleteBrief: () => http.delete<void>('/me/stanley/discover/brief'),
  share: (includeNeeds: boolean) => http.get<{ text: string }>(`/me/stanley/discover/brief/share?includeNeeds=${includeNeeds}`),
}

/** Planner, group diplomat and sea-time intelligence (phase 9): the server shapes the day on the real calendar, finds the free hour, plans the evening, drafts the meeting message and reads a group's answers. Nothing is booked from these. */
export const stanleyPlanner = {
  shape: (body: { sailingId?: string; day: number; scenario: string; mobility: string; traveller?: unknown }) => http.post<unknown>('/me/stanley/plan/shape', body),
  hour: (body: { sailingId?: string; day: number; from: string; placeId?: string; mobility: string }) => http.post<unknown>('/me/stanley/plan/hour', body),
  evening: (body: { sailingId?: string; day: number; mobility: string }) => http.post<unknown>('/me/stanley/plan/evening', body),
  preview: (body: { sailingId?: string; excursionId: string; scenario?: string; mobility: string }) => http.post<unknown>('/me/stanley/plan/preview', body),
  meeting: (body: { sailingId?: string; day?: number; placeId: string; time: string; note?: string }) => http.post<unknown>('/me/stanley/plan/meeting', body),
  compareTours: (body: { sailingId?: string; a: string; b: string }) => http.post<unknown>('/me/stanley/plan/compare-tours', body),
  groupStatus: (body: unknown) => http.post<unknown>('/stanley/group/status', body),
}

/** Which Stanley routes the server has switched off (`GET /me/stanley/status`). */
export const fetchStanleyStatus = (): Promise<unknown> => http.get<unknown>('/me/stanley/status')

/** Asks guest services for a call back, a caregiver or a sensory kit; the server answers with the guest's place in the staff queue. */
export const staffRequest = (kind: 'callback' | 'caregiver' | 'kit', reason?: string): Promise<unknown> => http.post<unknown>('/me/staff-requests', { kind, reason })

/** The caller's guest services requests from the last two hours (the server keeps them, so every device shows the same ticket). */
export const staffTickets = (): Promise<unknown> => http.get<unknown>('/me/staff-requests')

/** Cancels one of those requests. */
export const cancelStaffTicket = (id: string): Promise<void> => http.delete<void>(`/me/staff-requests/${encodeURIComponent(id)}`)

/** Family-at-home links signed by the server: make, stop, stop all, send a postcard and open a link's page (no sign-in). */
export const familyHome = {
  issue: (days: number) => http.post<unknown>('/me/family-links', { days }),
  revoke: (id: string) => http.delete<void>(`/me/family-links/${encodeURIComponent(id)}`),
  revokeAll: () => http.delete<void>('/me/family-links'),
  postcard: (kind: string, note: string, photoId?: string) => http.post<void>('/me/family-postcards', { kind, note, photoId }),
  view: (token: string) => http.get<unknown>(`/public/family/${encodeURIComponent(token)}`, { anonymous: true }),
  /** Where a postcard's picture is on the family page: an address an image tag can load, because the link itself is the permission. */
  photoUrl: (token: string, photoId: string) => `${API_URL}/public/family/${encodeURIComponent(token)}/photos/${encodeURIComponent(photoId)}`,
  setRecap: (text: string) => http.put<void>('/me/family-recap', { text }),
  clearRecap: () => http.delete<void>('/me/family-recap'),
}

/** The guest's own pictures (N7): send one, list them, fetch one as bytes (with the sign-in token, which an image tag cannot send), delete one, and the pictures of a stateroom type. */
export const guestMedia = {
  upload: (file: Blob, meta: { purpose: string; ref: string; kind?: string; caption?: string }) => http.upload<unknown>('/me/media', file, { query: { purpose: meta.purpose, ref: meta.ref, kind: meta.kind ?? '', caption: meta.caption ?? '' } }),
  mine: (purpose?: string) => http.get<unknown>('/me/media', { query: { purpose } }),
  usage: () => http.get<unknown>('/me/media/usage'),
  remove: (id: string) => http.delete<void>(`/me/media/${encodeURIComponent(id)}`),
  cabin: (category: string) => http.get<unknown>(`/cabin-photos/${encodeURIComponent(category)}`),
  file: (id: string) => http.blob(`/media/${encodeURIComponent(id)}`),
}

/** The party's shared view and the read-only links (N4): the organiser's roster, the change log, caregiver and advisor links, and a link's own page (no sign-in). */
export const partyShare = {
  organiser: (booking: string) => http.get<unknown>(`/bookings/${encodeURIComponent(booking)}/organiser`),
  log: (booking: string) => http.get<unknown>(`/bookings/${encodeURIComponent(booking)}/party-log`),
  links: (booking: string) => http.get<unknown>(`/bookings/${encodeURIComponent(booking)}/share-links`),
  makeLink: (booking: string, kind: string, label: string) => http.post<unknown>(`/bookings/${encodeURIComponent(booking)}/share-links`, { kind, label }),
  endLink: (booking: string, id: string) => http.delete<void>(`/bookings/${encodeURIComponent(booking)}/share-links/${encodeURIComponent(id)}`),
  checkIn: (booking: string, id: string, note: string) => http.post<unknown>(`/bookings/${encodeURIComponent(booking)}/share-links/${encodeURIComponent(id)}/checkin`, { note }),
  view: (token: string) => http.get<unknown>(`/public/share/${encodeURIComponent(token)}`, { anonymous: true }),
}

{
  weekFeed.setFetcher((sailingId, prefs) => http.post<unknown>('/me/autopilot/plan', { sailingId, prefs: JSON.parse(prefs) }))
  trialDayFeed.setFetcher((day, wishes) => http.post<unknown>('/public/trial-day', { day, wish: JSON.parse(wishes) }, { anonymous: true }))
  dayPlanFeed.setFetcher((sailingId, day, wishes) => http.post<unknown>('/me/day-plan', { sailingId, day, wish: JSON.parse(wishes) }))
  skyFeed.setFetcher((date, port) => http.get<unknown>('/feeds/sky', { query: { date, port } }))
  flightFeed.setFetcher((number, date) => http.get<unknown>('/feeds/flight', { query: { number, date } }))
  // Consented reports go to the server's telemetry route (signed-in only; the queue waits otherwise).
  setTelemetrySender((items) => (auth.current() ? http.post('/telemetry', { items }) : Promise.reject(new Error('signed out'))))
  conditionsFeed.setFetcher((sailing, crowd) => http.get<unknown>('/feeds/route', { query: { sailing, crowd } }))
  crowdFeed.setFetcher((port, date) => http.get<unknown>('/feeds/port-crowd', { query: { port, date } }))
  faresFeed.setFetcher((number, total, booked, today) => http.get<unknown>('/feeds/fares', { query: { number, total, booked, today } }))
  pulseFeed.setFetcher((sailing, now) => http.get<unknown>('/feeds/pulse', { query: { sailing, now } }))
  pulseDayFeed.setFetcher((sailing, day) => http.get<unknown>('/feeds/pulse-day', { query: { sailing, day } }))
  savedFacts.setFetcher(() => http.get<unknown>('/me/stanley/facts'))
  tenderFeed.setFetcher((port, date) => http.get<unknown>('/feeds/tender', { query: { port, date } }))
  stormFeed.setFetcher((sailing, days) => http.get<unknown>('/feeds/storm', { query: { sailing, days } }))
  positionFeed.setFetcher((sailing, now) => http.get<unknown>('/feeds/ship-position', { query: { sailing, now } }))
  seaFeed.setFetcher((sailing, now) => http.get<unknown>('/feeds/sea-conditions', { query: { sailing, now } }))
  weatherFeed.setFetcher((sailing, hour) => http.get<unknown>('/feeds/ship-weather', { query: { sailing, now: hour } }))
  nauticalFeed.setFetcher((sailing, now) => http.get<unknown>('/feeds/ship-nautical', { query: { sailing, now } }))
  alongFeed.setFetcher((sailing, now) => http.get<unknown>('/feeds/along-the-way', { query: { sailing, now } }))
  skyNightFeed.setFetcher((sailing, day) => http.get<unknown>('/feeds/sky-night', { query: { sailing, day } }))
  loungerFeed.setFetcher((minute) => http.get<unknown>('/feeds/loungers', { query: { now: minute * 60_000 } }))
  sightingsFeed.setFetcher((day) => http.get<unknown>('/feeds/sightings', { query: { day } }))
  foundFeed.setFetcher(() => http.get<unknown>('/feeds/found'))
  qualityFeed.setFetcher((sailing) => http.get<unknown>('/feeds/sailing-quality', { query: { sailing } }))
  friendReplyFeed.setFetcher((name) => http.get<unknown>('/feeds/friend-reply', { query: { name } }))
  embarkFeed.setFetcher((priority, mobility, quiet, earliest) => http.get<unknown>('/feeds/embark-queue', { query: { priority, mobility, quiet, earliest } }))
  cabinGuideFeed.setFetcher((sailing, category, f) => http.get<unknown>(`/sailings/${encodeURIComponent(sailing)}/cabin-guide`, { anonymous: true, query: { category, quiet: f.quiet, calmSea: f.calmSea, accessible: f.accessible, clearView: f.clearView, availableOnly: f.availableOnly } }))
  openingFeed.setFetcher((id, created, slot) => http.get<unknown>('/feeds/watch-opening', { query: { id, created, slot } }))
  for (const f of [savedFacts, dayPlanFeed, weekFeed, skyFeed, flightFeed, conditionsFeed, crowdFeed, faresFeed, pulseFeed, pulseDayFeed, stormFeed, tenderFeed, skyNightFeed, positionFeed, seaFeed, weatherFeed, nauticalFeed, alongFeed, loungerFeed, sightingsFeed, foundFeed, openingFeed, qualityFeed, friendReplyFeed, embarkFeed, cabinGuideFeed]) auth.subscribe(f.forget)
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
  const store = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }
  const kept = cacheGet(store(), 'access', 'v1', normalizeAccessReference, Date.now())
  if (kept) setServedAccess(kept.value)
  void http.get<unknown>('/reference/access')
    .then((raw) => {
      const fresh = normalizeAccessReference(raw)
      if (!fresh) return
      if (fresh.version !== kept?.value.version) setServedAccess(fresh)
      cachePut(store(), 'access', 'v1', raw, Date.now())
    })
    .catch(() => {})
}


/**
 * The served reference tables (sailings, ship, programme, and the rest). The server wants a sign-in for them, so the copy kept on this device is applied
 * at once (before anyone signs in), and the server is asked, with the person's token, each time someone is signed in: its answer is applied if its
 * `version` differs and the raw answer is kept for next time. A missing, unreachable or malformed answer leaves what is in use.
 */
interface Table<T extends { version: string } = { version: string }> { kind: string; path: string; normalize: (raw: unknown) => T | null; apply: (t: T) => void; required: boolean }
const table = <T extends { version: string }>(kind: string, path: string, normalize: (raw: unknown) => T | null, apply: (t: T) => void, required = false): Table => ({ kind, path, normalize, apply, required } as unknown as Table)
const TABLES: Table[] = [
  table('catalogue', '/reference/catalogue', normalizeCatalogue, applyCatalogue, true),
  table('sailings', '/reference/sailings', normalizeSailings, applySailings, true),
  table('ship', '/reference/ship', normalizeShip, applyShip),
  table('catalogue-ships', '/reference/catalogue/ships', normalizeShips, applyShips),
  table('catalogue-regions', '/reference/catalogue/regions', normalizeRegions, applyRegions),
  table('catalogue-ports', '/reference/catalogue/ports', normalizeCataloguePorts, applyCataloguePorts),
  table('catalogue-patterns', '/reference/catalogue/patterns', normalizePatterns, applyPatterns),
  table('program', '/reference/program', normalizeProgram, applyProgram),
  table('ports', '/reference/ports', normalizePorts, applyPorts, true),
  table('packages', '/reference/packages', normalizePackages, applyPackages),
  table('limits', '/reference/limits', normalizeLimits, applyLimits),
  table('entry', '/reference/entry', normalizeEntry, applyEntry),
  table('pricing', '/reference/pricing', normalizePricing, applyPricing, true),
  table('content', '/reference/content', normalizeContent, applyContent),
]
const tableStore = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }
/** The version of each table in use, so a refetch applies only a change. */
const inUse = new Map<string, string>()

function applyKeptTables(): void {
  for (const t of TABLES) {
    const kept = cacheGet(tableStore(), t.kind, 'v1', t.normalize, Date.now())
    if (kept) { t.apply(kept.value); inUse.set(t.kind, kept.value.version); markReferenceReady(t.kind) }
  }
}

/** Asks again after a failure (the waiting page's button). */
export function retryReference(): void {
  markReferenceRetry()
  loadTables()
}

function loadTables(): void {
  if (!auth.current()) return
  for (const t of TABLES) {
    void http.get<unknown>(t.path)
      .then((raw) => {
        const fresh = t.normalize(raw)
        if (!fresh) { markReferenceFailed(t.kind); return }
        if (fresh.version !== inUse.get(t.kind)) { t.apply(fresh); inUse.set(t.kind, fresh.version) }
        markReferenceReady(t.kind)
        cachePut(tableStore(), t.kind, 'v1', raw, Date.now())
      })
      .catch(() => markReferenceFailed(t.kind))
  }
}
/**
 * One sailing's days are fetched when a screen asks (`loadItinerary`), and the last answer for each is kept on this device so an offline guest still sees
 * the route of the sailing they were looking at. Without a sign-in the kept copy is all there is.
 */
setItineraryLoader(async (sailingId) => {
  const kind = 'itinerary'
  const kept = () => cacheGet(tableStore(), kind, sailingId, (raw) => raw, Date.now())?.value
  if (!auth.current()) return kept()
  try {
    const raw = await http.get<unknown>(`/reference/sailings/${encodeURIComponent(sailingId)}/itinerary`)
    cachePut(tableStore(), kind, sailingId, raw, Date.now())
    return raw
  } catch (e) {
    const old = kept()
    if (old) return old
    throw e
  }
})
/** A ship's deck plan, fetched when its sailing is in focus and kept on this device, so an offline guest aboard still has the plan of their ship. */
setPlanLoader(async (shipId) => {
  const kind = 'aboard'
  const kept = () => cacheGet(tableStore(), kind, shipId, (raw) => raw, Date.now())?.value
  if (!auth.current()) return kept()
  try {
    const raw = await http.get<unknown>(`/reference/ships/${encodeURIComponent(shipId)}/aboard`)
    cachePut(tableStore(), kind, shipId, raw, Date.now())
    return raw
  } catch (e) {
    const old = kept()
    if (old) return old
    throw e
  }
})
/** A ship's dining rooms, menus and delivery zones, fetched when its sailing is in focus and kept on this device like its deck plan. */
setVenueLoader(async (shipId) => {
  const kind = 'venues'
  const kept = () => cacheGet(tableStore(), kind, shipId, (raw) => raw, Date.now())?.value
  if (!auth.current()) return kept()
  try {
    const raw = await http.get<unknown>(`/reference/ships/${encodeURIComponent(shipId)}/venues`)
    cachePut(tableStore(), kind, shipId, raw, Date.now())
    return raw
  } catch (e) {
    const old = kept()
    if (old) return old
    throw e
  }
})
/** A ship's programme, fetched when its sailing is in focus and kept on this device like its deck plan. */
setProgramLoader(async (shipId) => {
  const kind = 'programme'
  const kept = () => cacheGet(tableStore(), kind, shipId, (raw) => raw, Date.now())?.value
  if (!auth.current()) return kept()
  try {
    const raw = await http.get<unknown>(`/reference/ships/${encodeURIComponent(shipId)}/program`)
    cachePut(tableStore(), kind, shipId, raw, Date.now())
    return raw
  } catch (e) {
    const old = kept()
    if (old) return old
    throw e
  }
})
/** A sailing's rooms with sample fares, and a ship's rooms, fetched when a screen asks (only the server knows another ship's stateroom types). */
setRoomLoaders({
  sailing: (sailingId) => http.get<unknown>(`/reference/sailings/${encodeURIComponent(sailingId)}/rooms`),
  ship: (shipId) => http.get<unknown>(`/reference/catalogue/ships/${encodeURIComponent(shipId)}`),
})
requireReference(TABLES.filter((t) => t.required).map((t) => t.kind))
applyKeptTables()

/**
 * The copies on this device belong to one person. When someone else signs in, the earlier person's copies are removed (only changes that have not
 * reached the server yet are left, see `UNSENT_PREFIXES`), so a shared phone never shows or sends the wrong person's data. The server is the source: a
 * new device, or a cleared one, pulls.
 */
function claimDevice(userId: string | null | undefined): void {
  const store = local()
  if (!store || !userId) return
  try {
    const before = store.getItem(OWNER_KEY)
    if (before && before !== userId) clearPersonCopies(store, UNSENT_PREFIXES)
    if (before !== userId) store.setItem(OWNER_KEY, userId)
  } catch { /* storage blocked: nothing is kept either */ }
}

/** Points the sync module at the signed-in person (or at nobody) and fetches their account state. Does nothing without the real API. */
function syncAccount(): void {
  loadReference()
  loadTables()
  const session = auth.current()
  claimDevice(session?.user?.id)
  loadContext()
  setRemote(session ? createHttpRemote(http) : null)
  setPortRowsRemote(session ? createHttpPortRows(http) : null)
  if (sync.setOwner(session?.user?.id ?? null, ownerIdOf(session))) void sync.pull()
  if (portRows.setOwner(session?.user?.id ?? null, ownerIdOf(session))) void portRows.pull()
  if (session?.user?.isDemo) void pullDemoFromServer()
}

/** Who is signed in, their trip, the sailing and the server's time (`GET /me/context`); cleared at sign-out. Nothing about it is kept on the device. */
let contextFor: string | undefined
export function loadContext(): void {
  const session = auth.current()
  markAccount(session ? (session.user?.isDemo ?? null) : null)
  if (!session) { setContext(null); contextFor = undefined; return }
  const who = session.user?.id
  if (who !== contextFor) { setContext(null); contextFor = who }
  void refreshContext(() => http.get<unknown>('/me/context'), () => auth.current()?.user?.id === who)
}

/** What a guest can do that moves their journey stage (`POST /me/journey/events`). */
export type JourneyEventKind = 'lookCloser' | 'priceView' | 'cabinView' | 'sharedAccepted' | 'planImported' | 'atTerminal'

const sentEvents = new Set<string>()

/**
 * Tells the server the guest did something that moves their stage, then asks for the stage again. Sent at most once per kind and sailing in a session,
 * only while signed in, and never throws: a refused or lost event just means the stage waits for the next one.
 */
export async function recordJourney(kind: JourneyEventKind, sailingId: string | null | undefined): Promise<void> {
  if (!sailingId || !auth.current()) return
  const key = `${auth.current()?.user?.id}:${kind}:${sailingId}`
  if (sentEvents.has(key)) return
  sentEvents.add(key)
  try {
    await http.post('/me/journey/events', { kind, sailingId })
    loadContext()
  } catch { sentEvents.delete(key) }
}

/** Account state is fetched again when the tab is shown or the connection returns, so a change made on another device appears. Returns the stop function. */
function watchDeviceReturn(): () => void {
  if (typeof window === 'undefined') return () => {}
  const onOnline = () => { loadContext(); void sync.pull(); void portRows.pull(); void pullDemoFromServer(); void flushTelemetry() }
  const onVisible = () => { if (document.visibilityState === 'visible') { loadContext(); void sync.pull(); void portRows.pull(); void pullDemoFromServer() } else void flushTelemetry() }
  // The stage is worked out by the server from the clock and what the guest has done, so it is asked for again as time passes and after a testing-date change.
  const stopTicking = startVisibleInterval(loadContext, CONTEXT_REFRESH_MS)
  onDemoSent(loadContext)
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    stopTicking()
    onDemoSent(null)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
/** How often a visible app asks the server which stage the guest is in. */
const CONTEXT_REFRESH_MS = 60_000
let stopWatchingDevice: () => void = () => {}

/** Start-up: sign in as the last person (or Gerald, the primary persona), use their settings, and listen to other tabs. Call once before first render. */
export async function startRuntime(): Promise<void> {
  sweepExpiredCopies(local(), Date.now())
  watchOtherTabs()
  registerSyncBindings()
  stopWatchingDevice()
  stopWatchingDevice = watchDeviceReturn()
  auth.subscribe(() => {
    switchSettingsOwner(null, ownerIdOf(auth.current()))
    syncAccount()
  })
  await auth.restore()
  switchSettingsOwner(null, ownerIdOf(auth.current()))
  syncAccount()
}

/** Sign out after sending any change still waiting to reach the account, so nothing typed just before is lost (a failed send does not block signing out). */
export async function signOutEverywhereSaving(): Promise<void> {
  await Promise.all([sync.flush().catch(() => {}), portRows.flush().catch(() => {})])
  // Unlike a plain sign out this must reach the server, or the other devices stay signed in; a failure throws and keeps this device signed in.
  if (!auth.account) throw new Error('unsupported')
  await auth.account.signOutEverywhere()
  clearOwnCopies()
}

export async function signOutSaving(): Promise<void> {
  await Promise.all([sync.flush().catch(() => {}), portRows.flush().catch(() => {})])
  await auth.signOut()
  clearOwnCopies()
}

/**
 * After sign-out, removes everything this device kept for the person. If a change still has not reached the server (the sync indicator shows it),
 * their documents stay (saved screens still go), so nothing typed is lost; so does the outbox of unsent messages. The next different person to sign in clears what stays.
 */
function clearOwnCopies(): void {
  const store = local()
  if (!store) return
  const waiting = sync.status() === 'error' || portRows.status() === 'error'
  if (!waiting) clearPersonCopies(store, UNSENT_PREFIXES)
  else clearSavedScreens(store)   // a typed change may wait, but the read-only copies (boarding pass, muster, found items) never stay on a signed-out device
  const stillUnsent = waiting || Array.from({ length: store.length }, (_, i) => store.key(i)).some((k) => !!k && k.startsWith(UNSENT_PREFIXES[0]))
  if (!stillUnsent) { try { store.removeItem(OWNER_KEY) } catch { /* blocked */ } }
}

/** "Reset demo": the demo controls go back to first-run and the account's demo data is reset on the server. Display settings and who is signed in are kept. */
export async function resetDemoData(): Promise<void> {
  await resetDemo(local())
  resetDemoState()
}

/** "Delete my data" (privacy centre): the account's saved documents on the server first, then this device. If the server cannot be reached nothing is wiped, so the guest is never told it is gone when it is not. */
export async function deleteMyData(): Promise<void> {
  await http.delete<void>('/me/state')
  await wipeAll()
}

/** "Wipe everything": every setting and the sign-in kept on this device; the page reloads to a clean first run. The account's data stays on the server. */
export async function wipeAll(): Promise<void> {
  wipeEverything({ local: local(), session: session() })
  resetSettingsToDefaults()
  location.reload()
}
