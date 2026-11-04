import { describe, expect, it } from 'vitest'
import { peekStanleyRequest, requestStanley, subscribeStanleyRequest, takeStanleyRequest } from './stanleyOpen'

describe('requestStanley', () => {
  it('tells listeners, carries trimmed words and is taken once', () => {
    let calls = 0
    const off = subscribeStanleyRequest(() => { calls++ })
    requestStanley('  what time is dinner?  ')
    expect(calls).toBe(1)
    expect(peekStanleyRequest()?.prefill).toBe('what time is dinner?')
    expect(takeStanleyRequest()?.prefill).toBe('what time is dinner?')
    expect(takeStanleyRequest()).toBeNull()
    off()
    requestStanley()
    expect(calls).toBe(1)
    takeStanleyRequest()
  })
})
