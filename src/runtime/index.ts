import { createMockApi } from '../api/mock'
import type { Api } from '../api/types'
import { createMockAuthProvider } from '../auth/mockProvider'
import type { AuthProvider } from '../auth/provider'
import { deleteDatabase, openStore } from '../data/idbStore'
import { resetDemo, wipeEverything } from '../data/lifecycle'
import type { DataRecord, DataStore } from '../data/store'
import { getDemo, resetDemoState, watchOtherTabs } from '../demo/store'
import { DEFAULT_PERSONA, personaById } from '../domain/personas'
import { resetSettingsToDefaults, switchSettingsOwner } from '../settings/store'
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

export const auth: AuthProvider = createMockAuthProvider({ session: session(), local: local(), channel })

export const api: Api = createMockApi({
  store: lazyStore,
  demo: getDemo,
  persona: () => auth.current()?.personaId ?? null,
  channel,
})

/** Start-up: sign in as the last person (or Gerald, the primary persona), use their settings, and listen to other tabs. Call once before first render. */
export async function startRuntime(): Promise<void> {
  watchOtherTabs()
  auth.subscribe(() => switchSettingsOwner(personaById(auth.current()?.personaId) ?? null))
  if (!auth.current()) await auth.signIn({ method: 'demo', personaId: DEFAULT_PERSONA })
  else switchSettingsOwner(personaById(auth.current()!.personaId) ?? null)
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
