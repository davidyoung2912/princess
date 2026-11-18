// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { markOpenedByLink, openedByLink, wasOpenedByLink } from './openedByLink'

describe('addresses the app itself opened', () => {
  beforeEach(() => sessionStorage.clear())
  it('lets a followed link through, and judges a typed or refreshed address', () => {
    expect(openedByLink('PUSH', '/book')).toBe(true)
    expect(openedByLink('REPLACE', '/book/room')).toBe(true)
    expect(openedByLink('POP', '/book')).toBe(false)
  })
  it('remembers an address the app opened, so refreshing it is not stale, within this tab only', () => {
    markOpenedByLink('/book')
    expect(wasOpenedByLink('/book')).toBe(true)
    expect(openedByLink('POP', '/book')).toBe(true)
    expect(openedByLink('POP', '/me/settings')).toBe(false)
    sessionStorage.clear()
    expect(openedByLink('POP', '/book')).toBe(false)
  })
  it('keeps no more than the latest 60', () => {
    for (let i = 0; i < 70; i++) markOpenedByLink(`/x${i}`)
    expect(wasOpenedByLink('/x0')).toBe(false)
    expect(wasOpenedByLink('/x69')).toBe(true)
  })
})
