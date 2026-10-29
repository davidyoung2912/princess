import { deleteDB, openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb'
import { mapStorageError } from './errors'
import { recordKey, type DataRecord, type DataStore } from './store'

export const DB_NAME = 'princess'

interface Schema extends DBSchema {
  records: { key: string; value: DataRecord & { key: string }; indexes: { kind: string; owner: string } }
  meta: { key: string; value: unknown }
}

type UpgradeTx = IDBPTransaction<Schema, StoreNames<Schema>[], 'versionchange'>

/** One step per schema version: `UPGRADES[0]` creates version 1, `UPGRADES[1]` moves a version-1 database to 2, and so on. */
export type Upgrade = (db: IDBPDatabase<Schema>, tx: UpgradeTx) => void | Promise<void>

export const UPGRADES: readonly Upgrade[] = [
  (db) => {
    const records = db.createObjectStore('records', { keyPath: 'key' })
    records.createIndex('kind', 'kind')
    records.createIndex('owner', 'owner')
    db.createObjectStore('meta')
  },
]

/** Opens (and, when older, upgrades) the database. Upgrades run in order inside one transaction; a failure leaves the old version intact. */
export async function openStore(name = DB_NAME, upgrades: readonly Upgrade[] = UPGRADES, onBlocked?: () => void): Promise<DataStore> {
  let db: IDBPDatabase<Schema>
  try {
    db = await openDB<Schema>(name, upgrades.length, {
      async upgrade(database, oldVersion, _new, tx) {
        for (let v = oldVersion; v < upgrades.length; v++) await upgrades[v](database, tx)
      },
      blocked: () => onBlocked?.(),
      // Another tab asked to upgrade: step aside so it can.
      blocking: () => db?.close(),
    })
  } catch (e) {
    throw mapStorageError(e)
  }
  const guard = async <T>(run: () => Promise<T>): Promise<T> => {
    try { return await run() } catch (e) { throw mapStorageError(e) }
  }
  const strip = ({ key: _key, ...r }: DataRecord & { key: string }): DataRecord => r
  const byAge = (a: DataRecord, b: DataRecord) => a.updatedAt - b.updatedAt || a.id.localeCompare(b.id)
  return {
    get: (k, o, i) => guard(async () => { const r = await db.get('records', recordKey(k, o, i)); return r && strip(r) }),
    put: (r) => guard(async () => { await db.put('records', { ...r, key: recordKey(r.kind, r.owner, r.id) }) }),
    delete: (k, o, i) => guard(() => db.delete('records', recordKey(k, o, i))),
    list: (kind, owner) => guard(async () => (await db.getAllFromIndex('records', 'kind', kind)).filter((r) => owner === undefined || r.owner === owner).map(strip).sort(byAge)),
    all: (owner) => guard(async () => (owner === undefined ? await db.getAll('records') : await db.getAllFromIndex('records', 'owner', owner)).map(strip).sort(byAge)),
    clear: () => guard(() => db.clear('records')),
    getMeta: (key) => guard(() => db.get('meta', key)),
    setMeta: (key, value) => guard(async () => { await db.put('meta', value, key) }),
    close: () => db.close(),
  }
}

/** Deletes the whole database ("Wipe everything"). */
export async function deleteDatabase(name = DB_NAME): Promise<void> {
  try { await deleteDB(name) } catch (e) { throw mapStorageError(e) }
}
