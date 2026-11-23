import { describe, expect, it } from 'vitest'
import { noticesToShow, type Incident } from './serviceNotice'

const inc = (id: string, startedAt: number, resolvedAt: number | null = null): Incident => ({ id, area: 'dining', startedAt, message: 'm', resolvedAt })

describe('service notices', () => {
  it('shows open problems, oldest first', () => {
    expect(noticesToShow([inc('b', 20), inc('a', 10)], new Set()).map((i) => i.id)).toEqual(['a', 'b'])
  })
  it('leaves out resolved problems', () => { expect(noticesToShow([inc('a', 1, 5)], new Set())).toEqual([]) })
  it('leaves out the ones put away this visit but not new ones', () => {
    expect(noticesToShow([inc('a', 1), inc('b', 2)], new Set(['a'])).map((i) => i.id)).toEqual(['b'])
  })
  it('says nothing when the feed could not be read', () => {
    expect(noticesToShow(null, new Set())).toEqual([])
    expect(noticesToShow(undefined, new Set())).toEqual([])
  })
})
