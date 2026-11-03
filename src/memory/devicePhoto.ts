import { APP_PREFIX } from '../data/lifecycle'

/** The empty-cabin photo (D7-1) lives in this browser only: a small copy in local storage, never sent anywhere and never part of the synced memory. */
const KEY = `${APP_PREFIX}cabin-photo`
const MAX_SIDE = 900

export interface CabinPhoto { dataUrl: string; at: number }

export function loadCabinPhoto(): CabinPhoto | null {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<CabinPhoto> | null
    return o && typeof o.dataUrl === 'string' && o.dataUrl.startsWith('data:image/') && typeof o.at === 'number' ? { dataUrl: o.dataUrl, at: o.at } : null
  } catch { return null }
}

export function clearCabinPhoto(): void {
  try { localStorage.removeItem(KEY) } catch { /* nothing kept */ }
}

/** Shrinks the picked image so it fits in local storage, then keeps it. Resolves to the saved photo, or null when the browser cannot read or keep it. */
export async function keepCabinPhoto(file: File, now: number): Promise<CabinPhoto | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const photo = { dataUrl: canvas.toDataURL('image/jpeg', 0.6), at: now }
    localStorage.setItem(KEY, JSON.stringify(photo))
    return photo
  } catch { return null }
}
