import { describe, expect, it } from 'vitest'
import { normalizeChecklist } from './stanleyChecklist'

const item = (id: string, route = '/home/check-in', extra: object = {}) => ({ id, traveller: 1, kind: 'checkin', title: id, route, default: null, ...extra })
const list = (items: unknown[], extra: object = {}) => ({ hasTrip: true, items, done: 1, total: 4, complete: false, notChecked: ['x', 2], asOf: 't', ...extra })

describe('normalizeChecklist', () => {
  it('rejects a wrong shape', () => {
    expect(normalizeChecklist(null)).toBeNull()
    expect(normalizeChecklist({ items: [] })).toBeNull()
  })

  it('keeps the server order and drops an item that leaves the app', () => {
    const c = normalizeChecklist(list([item('a'), item('b', 'https://evil.example'), item('c', '//evil'), item('d', '/plan/dining')]))
    expect(c?.items.map((i) => i.id)).toEqual(['a', 'd'])
    expect(c?.notChecked).toEqual(['x'])
  })

  it('is never complete while it holds an item, and done never passes total', () => {
    const c = normalizeChecklist(list([item('a')], { complete: true, done: 9 }))
    expect(c?.complete).toBe(false)
    expect(c?.done).toBe(4)
  })

  it('shows a default only with both its words and its source', () => {
    expect(normalizeChecklist(list([item('a', '/plan/dining', { default: { label: 'Late', source: 'You told me' } })]))?.items[0].default).toEqual({ label: 'Late', source: 'You told me' })
    expect(normalizeChecklist(list([item('a', '/plan/dining', { default: { label: 'Late', source: '' } })]))?.items[0].default).toBeNull()
  })
})
