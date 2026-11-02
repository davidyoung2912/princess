// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { useWakeLock } from './useWakeLock'

afterEach(() => { cleanup(); Reflect.deleteProperty(navigator, 'wakeLock') })
const Probe = ({ on = true }: { on?: boolean }) => { useWakeLock(on); return null }

describe('keeping the screen on (N3.5)', () => {
  it('asks for the screen lock while the screen is open and gives it back when it closes', async () => {
    const release = vi.fn(async () => undefined)
    const request = vi.fn(async () => ({ release }))
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
    const view = render(<Probe />)
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'))
    view.unmount()
    await vi.waitFor(() => expect(release).toHaveBeenCalled())
  })

  it('does nothing in a browser without it, or when switched off', () => {
    expect(() => render(<Probe />)).not.toThrow()
    const request = vi.fn(async () => ({ release: async () => undefined }))
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
    render(<Probe on={false} />)
    expect(request).not.toHaveBeenCalled()
  })
})
