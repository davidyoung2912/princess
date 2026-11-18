import { useEffect, useSyncExternalStore } from 'react'
import { api } from '../runtime'
import { getContext, subscribeContext } from '../account/context'

/**
 * The signed-in guest's chosen chat avatar (an id, or null for none), kept in memory so the picture in the top bar and the picker agree without each asking the server.
 * `undefined` until it has been read. The server holds the choice; nothing is kept on the device.
 */
let current: string | null | undefined
let loadedFor: string | null = null
const listeners = new Set<() => void>()
const tell = (): void => listeners.forEach((l) => l())

/** Called when the guest picks (or clears) a picture, so everything showing it changes at once. */
export function setMyAvatar(id: string | null): void {
  current = id
  tell()
}

export function useMyAvatar(): string | null | undefined {
  const who = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.id ?? null
  const value = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => current, () => undefined)
  useEffect(() => {
    if (!who || loadedFor === who) return
    loadedFor = who
    current = undefined
    tell()
    api.messages.avatar().then((id) => { if (loadedFor === who) { current = id; tell() } }).catch(() => { if (loadedFor === who) { loadedFor = null } })
  }, [who])
  return who ? value : undefined
}
