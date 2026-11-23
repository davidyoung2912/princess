import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyUpdate, clearUpdate, markUpdateReady, subscribeUpdate, updateReady } from './update'

afterEach(clearUpdate)

describe('update prompt', () => {
  it('says nothing is waiting until the service worker has a new version', () => {
    expect(updateReady()).toBe(false)
  })

  it('tells listeners when a version is ready, and reloads only when asked', () => {
    const listener = vi.fn()
    const reload = vi.fn()
    const off = subscribeUpdate(listener)
    markUpdateReady(reload)
    expect(updateReady()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
    applyUpdate()
    expect(reload).toHaveBeenCalledTimes(1)
    off()
    clearUpdate()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
