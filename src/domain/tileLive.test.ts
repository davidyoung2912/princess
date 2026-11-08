import { describe, expect, it } from 'vitest'
import { tileValues } from './tileLive'

const words = { checklist: (d: number, t: number) => `${d}/${t} done`, packing: (d: number, t: number) => `${d}/${t} packed` }

describe('tileValues', () => {
  it('words the checklist and packing progress', () => {
    expect(tileValues({ checklist: { done: 2, total: 9 }, packing: { ticked: 14, total: 40 } }, words)).toEqual({ '/plan/checklist': '2/9 done', '/plan/packing': '14/40 packed' })
  })
  it('says nothing for missing or empty facts, and never more done than total', () => {
    expect(tileValues({}, words)).toEqual({})
    expect(tileValues({ checklist: { done: 0, total: 0 }, packing: null }, words)).toEqual({})
    expect(tileValues({ packing: { ticked: 50, total: 40 } }, words)['/plan/packing']).toBe('40/40 packed')
  })
})
