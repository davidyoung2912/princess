/**
 * Served reference content (multi-device plan 3, follow-up to Phase 3 step 6): the option lists, menus, texts and tables that were compiled into the
 * client. A domain module registers each array or record it exports with `registerContent('<module>', { NAME, ... })` after declaring it; the
 * server's `GET /reference/content` then replaces the contents in place, so every import sees the served values and the authored copy is only the
 * first paint. Pure: no network, no storage.
 */
type Target = unknown[] | Record<string, unknown>

const targets = new Map<string, Target>()

/** Registers a module's arrays and records under `<module>.<NAME>`. */
export function registerContent(module: string, items: Readonly<Record<string, object>>): void {
  for (const [name, value] of Object.entries(items)) targets.set(`${module}.${name}`, value as Target)
}

export const contentKeys = (): string[] => [...targets.keys()].sort()

/** The current contents by key, as JSON-safe values (what the server serves; a test compares the two). */
export function contentSnapshot(): Record<string, unknown> {
  return Object.fromEntries(contentKeys().map((k) => [k, JSON.parse(JSON.stringify(targets.get(k)))]))
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Replaces registered contents in place. A key nobody registered, or a value of the other kind (list against record), is skipped. Returns how many were applied. */
export function setContent(values: Readonly<Record<string, unknown>>): number {
  let n = 0
  for (const [key, value] of Object.entries(values)) {
    const target = targets.get(key)
    if (!target) continue
    try {
      if (Array.isArray(target) && Array.isArray(value)) target.splice(0, target.length, ...value)
      else if (isRecord(target) && isRecord(value)) {
        for (const k of Object.keys(target)) delete target[k]
        Object.assign(target, value)
      } else continue
      n++
    } catch {
      // A frozen or sealed target keeps its authored value.
    }
  }
  return n
}

/** The JSON the server embeds and serves: one key per line, keys in order, so a change reads as a diff. `npm run content:gen` writes it. */
export function contentFileText(): string {
  const snap = contentSnapshot()
  return '{\n' + Object.keys(snap).map((k) => `${JSON.stringify(k)}: ${JSON.stringify(snap[k])}`).join(',\n') + '\n}\n'
}
