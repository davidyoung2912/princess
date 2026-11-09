import { saveOutbox, loadOutbox, notifyOutbox } from './outbox'
import { backupCount, buildBackup, mergeBackup, OUTBOX_PREFIX, parseBackup, scanOutboxes, type Backup, type ScanResult } from '../domain/deviceBackup'
import { demoNow } from '../demo/store'

const local = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export const scanDevice = (): ScanResult => scanOutboxes(local())

/** The file text for what is waiting on this phone, and how many items it holds. */
export function exportDevice(): { text: string; count: number; name: string } {
  const { outboxes } = scanDevice()
  const backup = buildBackup(outboxes, new Date(demoNow()))
  return { text: JSON.stringify(backup, null, 2), count: backupCount(backup), name: `princess-waiting-${backup.exportedAt.slice(0, 10)}.json` }
}

/** Puts a backup file back. Null when the file is not a backup of ours. */
export function recoverDevice(text: string): { added: number } | null {
  const backup: Backup | null = parseBackup(text)
  const store = local()
  if (!backup || !store) return null
  const current = Object.fromEntries(Object.keys(backup.outboxes).map((k) => [k, loadOutbox(store, k)]))
  const { outboxes, added } = mergeBackup(current, backup)
  for (const [k, list] of Object.entries(outboxes)) saveOutbox(store, k, list)
  notifyOutbox()
  return { added }
}

/** Clears what cannot be read, after the guest has been told: a damaged outbox is removed, a partly damaged one keeps its readable items. Returns how many outboxes were affected. */
export function clearUnreadable(): number {
  const store = local()
  const { corrupt, outboxes } = scanDevice()
  for (const k of corrupt) {
    const good = outboxes[k.slice(OUTBOX_PREFIX.length)]
    try { if (good) store?.setItem(k, JSON.stringify(good)); else store?.removeItem(k) } catch { /* ignore */ }
  }
  if (corrupt.length > 0) notifyOutbox()
  return corrupt.length
}

export { OUTBOX_PREFIX }
