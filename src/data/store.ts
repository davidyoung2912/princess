/**
 * The app's structured data: records grouped by kind (reservations, orders, messages …) and owner (a persona id, or ''
 * for data shared by everyone). Two implementations behind one interface: IndexedDB in the browser, memory in tests.
 */
export interface DataRecord {
  kind: string
  /** Persona id, or '' when shared. */
  owner: string
  id: string
  updatedAt: number
  data: unknown
}

export interface DataStore {
  get(kind: string, owner: string, id: string): Promise<DataRecord | undefined>
  put(record: DataRecord): Promise<void>
  delete(kind: string, owner: string, id: string): Promise<void>
  /** Records of a kind, oldest first; limited to one owner when given. */
  list(kind: string, owner?: string): Promise<DataRecord[]>
  /** Every record, or only one owner's (plus nothing shared). */
  all(owner?: string): Promise<DataRecord[]>
  clear(): Promise<void>
  getMeta(key: string): Promise<unknown>
  setMeta(key: string, value: unknown): Promise<void>
  close(): void
}

export const recordKey = (kind: string, owner: string, id: string): string => `${kind}\u0000${owner}\u0000${id}`

const byAge = (a: DataRecord, b: DataRecord) => a.updatedAt - b.updatedAt || a.id.localeCompare(b.id)

export function createMemoryStore(): DataStore {
  const records = new Map<string, DataRecord>()
  const meta = new Map<string, unknown>()
  const copy = (r: DataRecord): DataRecord => structuredClone(r)
  return {
    get: async (k, o, i) => { const r = records.get(recordKey(k, o, i)); return r ? copy(r) : undefined },
    put: async (r) => { records.set(recordKey(r.kind, r.owner, r.id), copy(r)) },
    delete: async (k, o, i) => { records.delete(recordKey(k, o, i)) },
    list: async (kind, owner) => [...records.values()].filter((r) => r.kind === kind && (owner === undefined || r.owner === owner)).sort(byAge).map(copy),
    all: async (owner) => [...records.values()].filter((r) => owner === undefined || r.owner === owner).sort(byAge).map(copy),
    clear: async () => { records.clear() },
    getMeta: async (key) => meta.get(key),
    setMeta: async (key, value) => { meta.set(key, value) },
    close: () => {},
  }
}
