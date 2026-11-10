import { afterEach, describe, expect, it, vi } from 'vitest'
import { gangwayScan, setGangwayRemote } from './gangway'

afterEach(() => setGangwayRemote(null))

describe('gangway scan', () => {
  it('does nothing without a server route, so the caller acts by hand', async () => {
    const pull = vi.fn(async () => undefined)
    expect(await gangwayScan('on', pull)).toBe(false)
    expect(pull).not.toHaveBeenCalled()
  })

  it('sends the direction and takes the rows back once the server has recorded it', async () => {
    const scan = vi.fn(async () => ({ status: 'back' }))
    const pull = vi.fn(async () => undefined)
    setGangwayRemote({ scan })
    expect(await gangwayScan('on', pull)).toBe(true)
    expect(scan).toHaveBeenCalledWith('on')
    expect(pull).toHaveBeenCalledOnce()
  })

  it('reports false, and pulls nothing, when the account has no such route or the call fails', async () => {
    const pull = vi.fn(async () => undefined)
    setGangwayRemote({ scan: async () => undefined })
    expect(await gangwayScan('off', pull)).toBe(false)
    setGangwayRemote({ scan: async () => { throw new Error('offline') } })
    expect(await gangwayScan('off', pull)).toBe(false)
    expect(pull).not.toHaveBeenCalled()
  })
})
