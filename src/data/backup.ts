import { StorageError } from './errors'
import type { DataRecord, DataStore } from './store'

/** Bump when the file layout changes; `parseBackup` then upgrades older files step by step. */
export const BACKUP_FORMAT = 1

export interface BackupFile {
  app: 'princess'
  format: number
  exportedAt: string
  /** Whose data this is: one persona id, or null for everything on the device. */
  owner: string | null
  records: DataRecord[]
}

/** The data as a file ("Export my data"): one persona's records, or everything when no owner is given. */
export async function createBackup(store: DataStore, owner: string | null, now: Date = new Date()): Promise<BackupFile> {
  return { app: 'princess', format: BACKUP_FORMAT, exportedAt: now.toISOString(), owner, records: await store.all(owner ?? undefined) }
}

export const backupToText = (b: BackupFile): string => JSON.stringify(b, null, 2)

/** Suggested file name, e.g. "princess-gerald-2027-03-21.json". */
export const backupFileName = (owner: string | null, now: Date): string => `princess-${owner ?? 'all'}-${now.toISOString().slice(0, 10)}.json`

const isRecord = (r: unknown): r is DataRecord => {
  if (!r || typeof r !== 'object') return false
  const o = r as Record<string, unknown>
  return typeof o.kind === 'string' && o.kind !== '' && typeof o.owner === 'string' && typeof o.id === 'string' && o.id !== '' && typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) && 'data' in o
}

/** A backup from untrusted text. Throws StorageError('corrupt') for anything that is not a Princess backup this version can read. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new StorageError('corrupt', 'The file is not valid JSON') }
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!o || o.app !== 'princess') throw new StorageError('corrupt', 'The file is not a Princess backup')
  if (typeof o.format !== 'number' || o.format < 1 || o.format > BACKUP_FORMAT) throw new StorageError('corrupt', 'The backup is from a newer version of the app')
  if (!Array.isArray(o.records) || !o.records.every(isRecord)) throw new StorageError('corrupt', 'The backup has damaged records')
  const owner = typeof o.owner === 'string' ? o.owner : null
  return { app: 'princess', format: BACKUP_FORMAT, exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : '', owner, records: o.records.map(({ kind, owner: ow, id, updatedAt, data }) => ({ kind, owner: ow, id, updatedAt, data })) }
}

/** Writes a backup's records into the store, replacing records with the same key; returns how many were written. */
export async function restoreBackup(store: DataStore, backup: BackupFile): Promise<number> {
  for (const r of backup.records) await store.put(r)
  return backup.records.length
}
