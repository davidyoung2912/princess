import { isItem, type OutboxItem } from '../data/outbox'

/**
 * Export and recovery of what is waiting on this phone (MOB-04): the unsent messages and requests in every outbox, as a file the guest can keep
 * and put back. Anything that cannot be read is reported plainly instead of being dropped without a word. Framework-free.
 */
export interface Backup {
  app: 'princess'
  version: 1
  exportedAt: string
  /** Outbox storage key (without the prefix) to the items waiting in it. */
  outboxes: Record<string, OutboxItem[]>
}

export const OUTBOX_PREFIX = 'princess:outbox:'

export interface ScanResult {
  outboxes: Record<string, OutboxItem[]>
  /** Storage keys whose content could not be read as a list of waiting items. */
  corrupt: string[]
}

type ReadStore = Pick<Storage, 'length' | 'key' | 'getItem'>

/** Reads every outbox on the device; an outbox that is not a list of valid items is `corrupt`, and items inside a readable list that are malformed are counted as corrupt too. */
export function scanOutboxes(store: ReadStore | null): ScanResult {
  const out: ScanResult = { outboxes: {}, corrupt: [] }
  try {
    if (!store) return out
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (!key?.startsWith(OUTBOX_PREFIX)) continue
      try {
        const parsed: unknown = JSON.parse(store.getItem(key) ?? '[]')
        if (!Array.isArray(parsed)) { out.corrupt.push(key); continue }
        const good = parsed.filter(isItem)
        if (good.length !== parsed.length) out.corrupt.push(key)
        if (good.length > 0) out.outboxes[key.slice(OUTBOX_PREFIX.length)] = good
      } catch {
        out.corrupt.push(key)
      }
    }
  } catch { /* storage blocked */ }
  return out
}

export const buildBackup = (outboxes: Record<string, OutboxItem[]>, now: Date): Backup => ({ app: 'princess', version: 1, exportedAt: now.toISOString(), outboxes })

/** How many items a backup holds. */
export const backupCount = (b: Pick<Backup, 'outboxes'>): number => Object.values(b.outboxes).reduce((n, l) => n + l.length, 0)

/** Reads a backup file; null when it is not one of ours or is damaged. Items that fail the check are left out rather than trusted. */
export function parseBackup(text: string): Backup | null {
  try {
    const o = JSON.parse(text) as Partial<Backup>
    if (!o || o.app !== 'princess' || o.version !== 1 || typeof o.exportedAt !== 'string' || !o.outboxes || typeof o.outboxes !== 'object' || Array.isArray(o.outboxes)) return null
    const outboxes: Record<string, OutboxItem[]> = {}
    for (const [key, list] of Object.entries(o.outboxes)) {
      if (!Array.isArray(list)) continue
      const good = list.filter(isItem)
      if (good.length > 0) outboxes[key] = good
    }
    return { app: 'princess', version: 1, exportedAt: o.exportedAt, outboxes }
  } catch {
    return null
  }
}

/** Puts a backup's items back, keeping anything already waiting (same id means same item). Returns the merged outboxes to write and how many were added. */
export function mergeBackup(current: Record<string, OutboxItem[]>, backup: Backup): { outboxes: Record<string, OutboxItem[]>; added: number } {
  const outboxes: Record<string, OutboxItem[]> = { ...current }
  let added = 0
  for (const [key, list] of Object.entries(backup.outboxes)) {
    const have = new Set((outboxes[key] ?? []).map((x) => x.id))
    const fresh = list.filter((x) => !have.has(x.id))
    added += fresh.length
    if (fresh.length > 0) outboxes[key] = [...(outboxes[key] ?? []), ...fresh]
  }
  return { outboxes, added }
}
