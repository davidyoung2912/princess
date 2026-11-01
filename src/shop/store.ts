import { APP_PREFIX } from '../data/lifecycle'
import { EMPTY_EXTRAS, normalizeExtras, type ShopExtras } from '../domain/shopExtras'

/** Delivery and gift choices stay on this device, one record per signed-in person. */
export const shopKeyFor = (personaId: string | null): string => `${APP_PREFIX}shop:${personaId ?? ''}`

type Reader = Pick<Storage, 'getItem'>
type Writer = Pick<Storage, 'setItem'>

export function loadExtras(personaId: string | null, storage: Reader | null = safeStorage()): ShopExtras {
  try {
    const text = storage?.getItem(shopKeyFor(personaId))
    return text ? normalizeExtras(JSON.parse(text)) : EMPTY_EXTRAS
  } catch {
    return EMPTY_EXTRAS
  }
}

export function saveExtras(personaId: string | null, state: ShopExtras, storage: Writer | null = safeStorage()): boolean {
  try {
    storage?.setItem(shopKeyFor(personaId), JSON.stringify(state))
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

const cache = new Map<string, ShopExtras>()
const listeners = new Set<() => void>()

export function getExtras(personaId: string | null): ShopExtras {
  const key = shopKeyFor(personaId)
  let s = cache.get(key)
  if (!s) { s = loadExtras(personaId); cache.set(key, s) }
  return s
}

export function subscribeExtras(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function updateExtras(personaId: string | null, change: (s: ShopExtras) => ShopExtras): void {
  const next = change(getExtras(personaId))
  cache.set(shopKeyFor(personaId), next)
  saveExtras(personaId, next)
  listeners.forEach((l) => l())
}
