import { describe, expect, it } from 'vitest'
import { normalizeDemoAccounts } from './demoAccounts'

describe('demo accounts from the server', () => {
  it('reads names and roles, and drops rows without an email', () => {
    expect(normalizeDemoAccounts([
      { email: 'gerald@demo.princess.example', firstName: 'Gerald', lastName: 'Harper', role: 'guest' },
      { email: '', firstName: 'No' },
      { firstName: 'Nobody' },
      { email: 'x@demo.princess.example' },
    ])).toEqual([
      { email: 'gerald@demo.princess.example', name: 'Gerald Harper', role: 'guest' },
      { email: 'x@demo.princess.example', name: 'x@demo.princess.example', role: '' },
    ])
  })
  it('treats anything that is not a list as empty', () => {
    expect(normalizeDemoAccounts(null)).toEqual([])
    expect(normalizeDemoAccounts({ email: 'a' })).toEqual([])
  })
})
