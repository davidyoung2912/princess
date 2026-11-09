// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { forgetTicks, loadTicks, resetTicks, toggleNeed } from './welcomeNeeds'

describe('stage need ticks', () => {
  beforeEach(() => { localStorage.clear(); forgetTicks() })

  it('ticks and unticks an item and keeps it on this device', () => {
    toggleNeed('book', 2)
    expect(loadTicks()).toEqual({ 'book.2': true })
    forgetTicks()
    expect(loadTicks()).toEqual({ 'book.2': true })
    toggleNeed('book', 2)
    expect(loadTicks()).toEqual({})
  })

  it('clears everything on reset and ignores stored junk', () => {
    toggleNeed('sea', 1); toggleNeed('port', 3)
    resetTicks()
    expect(loadTicks()).toEqual({})
    localStorage.setItem('princess.welcomeNeeds', '{"x.1":true,"sea.1":true}')
    forgetTicks()
    expect(loadTicks()).toEqual({ 'sea.1': true })
    localStorage.setItem('princess.welcomeNeeds', 'not json')
    forgetTicks()
    expect(loadTicks()).toEqual({})
  })
})
