import { describe, expect, it } from 'vitest'
import { optimistic } from './optimistic'

describe('optimistic updates (PERF-04)', () => {
  it('shows the change first and keeps it when saving works', async () => {
    const log: string[] = []
    const r = await optimistic(() => log.push('apply'), async () => { log.push('commit'); return 7 }, () => log.push('rollback'))
    expect(r).toBe(7)
    expect(log).toEqual(['apply', 'commit'])
  })

  it('puts the old state back and passes on the error when saving fails', async () => {
    const log: string[] = []
    const err = await optimistic(() => log.push('apply'), () => Promise.reject(new Error('no')), () => log.push('rollback')).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect(log).toEqual(['apply', 'rollback'])
  })
})
