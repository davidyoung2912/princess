import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startVisibleInterval, type VisibilitySource } from './visibleInterval'

function fakeDoc(hidden = false) {
  const listeners = new Set<() => void>()
  const doc: VisibilitySource & { hidden: boolean } = {
    hidden,
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
  }
  return { doc, listeners, change: (h: boolean) => { doc.hidden = h; [...listeners].forEach((l) => l()) } }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('visible interval (PERF-08)', () => {
  it('ticks while the page is visible and stops while hidden', () => {
    const f = fakeDoc()
    const fn = vi.fn()
    const stop = startVisibleInterval(fn, 1000, f.doc)
    vi.advanceTimersByTime(3000)
    expect(fn).toHaveBeenCalledTimes(3)
    f.change(true)
    vi.advanceTimersByTime(60_000)
    expect(fn).toHaveBeenCalledTimes(3)
    stop()
  })

  it('catches up once when the page comes back, then carries on', () => {
    const f = fakeDoc()
    const fn = vi.fn()
    const stop = startVisibleInterval(fn, 1000, f.doc)
    f.change(true)
    f.change(false)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    expect(fn).toHaveBeenCalledTimes(3)
    stop()
  })

  it('does not start on a hidden page, and leaves nothing running after stop', () => {
    const f = fakeDoc(true)
    const fn = vi.fn()
    const stop = startVisibleInterval(fn, 1000, f.doc)
    vi.advanceTimersByTime(5000)
    expect(fn).not.toHaveBeenCalled()
    f.change(false)
    stop()
    expect(f.listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    f.change(false)
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
