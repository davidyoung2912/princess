import { beforeEach, describe, expect, it } from 'vitest'
import { canGoBack, recordVisit, resetTrail } from './trail'

describe('navigation trail', () => {
  beforeEach(resetTrail)

  it('cannot go back from the first screen of a visit', () => {
    recordVisit('/', 'POP')
    expect(canGoBack()).toBe(false)
  })

  it('can go back after moving to another screen, and not after going back to the first', () => {
    recordVisit('/', 'POP')
    recordVisit('/me', 'PUSH')
    expect(canGoBack()).toBe(true)
    recordVisit('/', 'POP')
    expect(canGoBack()).toBe(false)
  })

  it('replaces the current screen instead of adding one', () => {
    recordVisit('/', 'POP')
    recordVisit('/me', 'REPLACE')
    expect(canGoBack()).toBe(false)
  })

  it('does not count the same address twice in a row, other than a deliberate push', () => {
    recordVisit('/', 'POP')
    recordVisit('/', 'POP')
    expect(canGoBack()).toBe(false)
    recordVisit('/', 'PUSH')
    expect(canGoBack()).toBe(true)
  })

  it('treats a browser forward step as a new screen', () => {
    recordVisit('/', 'POP')
    recordVisit('/a', 'PUSH')
    recordVisit('/', 'POP')
    recordVisit('/a', 'POP')
    expect(canGoBack()).toBe(true)
  })
})
