import { APP_PREFIX } from '../data/lifecycle'
import { normalizeDone, type PhoneStepId } from '../domain/phoneSetup'

/** Which phone-setup steps a person ticked, kept on this device (XT-01, S3-07). */
export const phoneKeyFor = (personaId: string | null): string => `${APP_PREFIX}phone:${personaId ?? ''}`

export function loadPhone(personaId: string | null, storage: Pick<Storage, 'getItem'> | null = safeStorage()): PhoneStepId[] {
  try {
    const text = storage?.getItem(phoneKeyFor(personaId))
    return text ? normalizeDone(JSON.parse(text)) : []
  } catch {
    return []
  }
}

export function savePhone(personaId: string | null, done: readonly PhoneStepId[], storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  try {
    storage?.setItem(phoneKeyFor(personaId), JSON.stringify(done))
    return !!storage
  } catch {
    return false
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const cache = new Map<string, PhoneStepId[]>()
const listeners = new Set<() => void>()

export function getPhone(personaId: string | null): PhoneStepId[] {
  const key = phoneKeyFor(personaId)
  let s = cache.get(key)
  if (!s) { s = loadPhone(personaId); cache.set(key, s) }
  return s
}

export function subscribePhone(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function updatePhone(personaId: string | null, change: (s: PhoneStepId[]) => PhoneStepId[]): void {
  const next = change(getPhone(personaId))
  cache.set(phoneKeyFor(personaId), next)
  savePhone(personaId, next)
  listeners.forEach((l) => l())
}
