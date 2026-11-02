import { useCallback, useEffect, useState } from 'react'
import { normalizeMediaList, type Media, type MediaPurpose } from '../domain/media'
import { guestMedia } from '../runtime'

/** The guest's own pictures for one purpose, newest first, and a way to ask again after adding or deleting one. */
export function useMyMedia(purpose: MediaPurpose): { list: Media[]; loaded: boolean; failed: boolean; reload: () => void } {
  const [list, setList] = useState<Media[]>([])
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    guestMedia.mine(purpose).then(
      (raw) => { if (live) { setList(normalizeMediaList(raw)); setLoaded(true); setFailed(false) } },
      () => { if (live) { setFailed(true); setLoaded(true) } },
    )
    return () => { live = false }
  }, [purpose, tick])
  return { list, loaded, failed, reload: useCallback(() => setTick((n) => n + 1), []) }
}

/** The pictures of a stateroom type: the guest's own, and others' approved ones when the server shows them. */
export function useCabinMedia(category: string): { list: Media[]; failed: boolean; reload: () => void } {
  const [list, setList] = useState<Media[]>([])
  const [failed, setFailed] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    guestMedia.cabin(category).then(
      (raw) => { if (live) { setList(normalizeMediaList(raw)); setFailed(false) } },
      () => { if (live) setFailed(true) },
    )
    return () => { live = false }
  }, [category, tick])
  return { list, failed, reload: useCallback(() => setTick((n) => n + 1), []) }
}

/** An address for a picture that needs the sign-in token to fetch: it is fetched with it, held as an object URL and let go when the picture is no longer on screen. */
export function useMediaUrl(id: string): { url: string | null; failed: boolean } {
  const [state, setState] = useState<{ id: string; url: string | null; failed: boolean }>({ id, url: null, failed: false })
  useEffect(() => {
    let live = true
    let made: string | null = null
    guestMedia.file(id).then(
      (blob) => {
        if (!live) return
        made = URL.createObjectURL(blob)
        setState({ id, url: made, failed: false })
      },
      () => { if (live) setState({ id, url: null, failed: true }) },
    )
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [id])
  return state.id === id ? { url: state.url, failed: state.failed } : { url: null, failed: false }
}
