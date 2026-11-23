import { describe, expect, it } from 'vitest'
import { applyRemoteWelcome, getWelcome, markSeen, markWelcomeLoaded, resetWelcomes, unmarkSeen, welcomeLoaded } from './store'
import { EMPTY_WELCOME, shouldShowWelcome } from '../routes/stageWelcome'

describe('stage welcome store', () => {
  it('waits for the server, remembers a welcome and shows it again after a reset', () => {
    const id = 'p-reset'
    expect(welcomeLoaded(id)).toBe(false)
    markWelcomeLoaded(id)
    expect(welcomeLoaded(id)).toBe(true)
    markSeen(id, 'dream', 1)
    expect(shouldShowWelcome('dream', null, getWelcome(id), true)).toBe(false)
    resetWelcomes(id)
    expect(getWelcome(id)).toBe(EMPTY_WELCOME)
    expect(shouldShowWelcome('dream', null, getWelcome(id), true)).toBe(true)
  })

  it('shows one stage again after it is unmarked, leaving the others', () => {
    const id = 'p-unmark'
    markSeen(id, 'dream', 1); markSeen(id, 'discover', 2)
    unmarkSeen(id, 'dream')
    expect(getWelcome(id).seen).toEqual({ discover: 2 })
    unmarkSeen(id, 'dream')
    expect(getWelcome(id).seen).toEqual({ discover: 2 })
  })

  it('keeps each person\'s welcomes apart and takes the server copy as it is', () => {
    applyRemoteWelcome('a', { seen: { discover: 5 } })
    expect(getWelcome('a').seen).toEqual({ discover: 5 })
    expect(getWelcome('b')).toBe(EMPTY_WELCOME)
    applyRemoteWelcome('a', null)
    expect(getWelcome('a')).toBe(EMPTY_WELCOME)
  })
})
