const KEY = 'princess.lastComparison'

/** The cabin comparison this device last had open, as the same query string a shared comparison link uses (a per-device convenience, never sent anywhere). */
export function loadLastComparison(): string {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}

export function saveLastComparison(query: string): void {
  try { if (query) localStorage.setItem(KEY, query); else localStorage.removeItem(KEY) } catch { /* private mode: nothing is kept */ }
}
