import { describe, expect, it } from 'vitest'
import { normalizeDemoAccounts } from './demoAccounts'

describe('demo accounts from the server', () => {
  it('reads names and roles, and drops rows without a username', () => {
    expect(normalizeDemoAccounts([
      { username: 'gerald', firstName: 'Gerald', lastName: 'Harper', role: 'guest' },
      { username: '', firstName: 'No' },
      { firstName: 'Nobody' },
      { username: 'xavier' },
    ])).toEqual([
      { username: 'gerald', name: 'Gerald Harper', role: 'guest' },
      { username: 'xavier', name: 'xavier', role: '' },
    ])
  })
  it('treats anything that is not a list as empty', () => {
    expect(normalizeDemoAccounts(null)).toEqual([])
    expect(normalizeDemoAccounts({ username: 'a' })).toEqual([])
  })
})
