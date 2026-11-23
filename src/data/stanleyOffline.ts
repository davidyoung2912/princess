import { readCache, readQueue, type QueuedConfirm, type ReminderCache } from '../ai/stanleyOffline'
import { deviceStore } from './deviceStorage'

/** What Stanley keeps on this phone for no-signal use (phase P3c): a copy of the next day of reminders, ids already shown, and confirms waiting to send. Cleared with the trip data; nothing here is the source of truth. */
const CACHE = 'princess:stanley-reminder-copy'
const SHOWN = 'princess:stanley-offline-shown'
const QUEUE = 'princess:stanley-confirm-queue'
const local = (): Storage | null => {
  return deviceStore()
}
const read = (k: string): unknown => { try { return JSON.parse(local()?.getItem(k) ?? 'null') } catch { return null } }
const write = (k: string, v: unknown): void => { try { local()?.setItem(k, JSON.stringify(v)) } catch { /* lasts for this visit only */ } }

export const loadReminderCopy = (): ReminderCache | null => readCache(read(CACHE))
export const saveReminderCopy = (c: ReminderCache): void => write(CACHE, c)
export const loadShown = (): string[] => { const v = read(SHOWN); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-100) : [] }
export const markShown = (ids: readonly string[]): string[] => { const next = [...new Set([...loadShown(), ...ids])].slice(-100); write(SHOWN, next); return next }
export const loadQueue = (): QueuedConfirm[] => readQueue(read(QUEUE))
export const saveQueue = (q: readonly QueuedConfirm[]): QueuedConfirm[] => { write(QUEUE, q); return [...q] }
/** Clear-out at disembark or sign-out. */
export function clearStanleyOffline(): void { for (const k of [CACHE, SHOWN, QUEUE]) { try { local()?.removeItem(k) } catch { /* nothing to clear */ } } }
