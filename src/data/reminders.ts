const KEY = 'princess:reminders-dismissed'
const MAX = 50
const local = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export function readDismissed(): string[] {
  try {
    const v: unknown = JSON.parse(local()?.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-MAX) : []
  } catch { return [] }
}

export function dismiss(key: string): string[] {
  const next = [...readDismissed().filter((k) => k !== key), key].slice(-MAX)
  try { local()?.setItem(KEY, JSON.stringify(next)) } catch { /* lasts for this visit only */ }
  return next
}
