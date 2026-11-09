import type { CustomReminder } from '../ai/stanleyAction'

/**
 * Reminders the guest asked Stanley for ("remind me at 4:15 to be back"), kept on this device only. They show in the app's reminder strip when they are due and the app is open or opens,
 * never as a background alert, and the strip says so.
 */
const KEY = 'princess:custom-reminders'
const MAX = 20
const local = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export function readCustom(): CustomReminder[] {
  try {
    const v: unknown = JSON.parse(local()?.getItem(KEY) ?? '[]')
    if (!Array.isArray(v)) return []
    return v.flatMap((x): CustomReminder[] => {
      const o = x as Partial<CustomReminder> | null
      return o && typeof o.id === 'string' && typeof o.at === 'number' && Number.isFinite(o.at) && typeof o.text === 'string' ? [{ id: o.id.slice(0, 64), at: o.at, text: o.text.slice(0, 80) }] : []
    }).slice(-MAX)
  } catch { return [] }
}

const save = (list: CustomReminder[]): CustomReminder[] => {
  try { local()?.setItem(KEY, JSON.stringify(list)) } catch { /* lasts for this visit only */ }
  return list
}

/** Keeps a reminder; the same id twice keeps one. */
export const addCustom = (r: CustomReminder): CustomReminder[] => save([...readCustom().filter((x) => x.id !== r.id), r].slice(-MAX))
/** Forgets a reminder (an undone action, or one the guest dismissed). */
export const removeCustom = (id: string): CustomReminder[] => save(readCustom().filter((x) => x.id !== id))
