import { lazy, type ComponentType } from 'react'

/** A screen loaded on first visit. `preload` fetches it ahead of time (tests use it so a screen renders in one pass). */
export type Screen = ComponentType & { preload: () => Promise<unknown> }

/** Wraps a dynamic import of one named export. Once loaded it renders directly, so a screen already visited never suspends again. */
export function screen<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K): Screen {
  let loaded: ComponentType | undefined
  const fetchIt = () => load().then((m) => {
    const component: ComponentType = m[name]
    loaded = component
    return { default: component }
  })
  const Lazy = lazy(fetchIt)
  const Wrapper = () => {
    const Loaded: ComponentType | undefined = loaded
    return Loaded ? <Loaded /> : <Lazy />
  }
  return Object.assign(Wrapper, { preload: fetchIt })
}
