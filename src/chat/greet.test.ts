import { describe, expect, it, vi } from 'vitest'
import { greetingFor, requestGreeting, subscribeGreeting, withGreeting } from './greet'

describe('chat greeting', () => {
  it('greets by first name', () => {
    expect(greetingFor('Maria L.')).toBe('Hey @Maria L., ')
    expect(greetingFor('  Stanley ')).toBe('Hey Stanley, ')
    expect(greetingFor('chattymom')).toBe('Hey @chattymom, ')
    expect(greetingFor('')).toBe('')
  })

  it('fills an empty box and leaves typed words alone', () => {
    expect(withGreeting('', 'Maria')).toBe('Hey @Maria, ')
    expect(withGreeting('   ', 'Maria')).toBe('Hey @Maria, ')
    expect(withGreeting('See you at 6', 'Maria')).toBe('See you at 6')
    expect(withGreeting('', '')).toBe('')
  })

  it('tells every listener until it unsubscribes', () => {
    const fn = vi.fn()
    const off = subscribeGreeting(fn)
    requestGreeting('Maria')
    off()
    requestGreeting('Sam')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('Maria')
  })
})
