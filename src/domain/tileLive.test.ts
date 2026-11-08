import { describe, expect, it } from 'vitest'
import { localDate, tileValues, tonightsDinner } from './tileLive'

const words = { checklist: (d: number, t: number) => `${d}/${t} done`, packing: (d: number, t: number) => `${d}/${t} packed`, dinners: (n: number) => `${n} dinners`, dinnersTonight: (n: number, t: string) => `${n} dinners, tonight ${t}`, docsReady: 'ready', docsMissing: (n: number) => `${n} missing`, docsPassport: (n: number) => `${n} passport` }

describe('tileValues', () => {
  it('words the checklist and packing progress', () => {
    expect(tileValues({ checklist: { done: 2, total: 9 }, packing: { ticked: 14, total: 40 } }, words)).toEqual({ '/plan/checklist': '2/9 done', '/plan/packing': '14/40 packed' })
  })
  it('says nothing for missing or empty facts, and never more done than total', () => {
    expect(tileValues({}, words)).toEqual({})
    expect(tileValues({ checklist: { done: 0, total: 0 }, packing: null }, words)).toEqual({})
    expect(tileValues({ packing: { ticked: 50, total: 40 } }, words)['/plan/packing']).toBe('40/40 packed')
  })
  it('counts dinners, including none', () => {
    expect(tileValues({ dinners: 0 }, words)['/plan/reservations']).toBe('0 dinners')
    expect(tileValues({ dinners: null }, words)).toEqual({})
  })
  it('puts a passport problem before missing documents before ready', () => {
    expect(tileValues({ documents: { missing: 2, passportProblems: 1 } }, words)['/me/documents']).toBe('1 passport')
    expect(tileValues({ documents: { missing: 2, passportProblems: 0 } }, words)['/me/documents']).toBe('2 missing')
    expect(tileValues({ documents: { missing: 0, passportProblems: 0 } }, words)['/me/documents']).toBe('ready')
    expect(tileValues({ documents: null }, words)).toEqual({})
  })
  it('adds tonight\'s dinner time when there is one', () => {
    expect(tileValues({ dinners: 2, tonight: '18:30' }, words)['/plan/reservations']).toBe('2 dinners, tonight 18:30')
    expect(tileValues({ dinners: 2, tonight: null }, words)['/plan/reservations']).toBe('2 dinners')
  })
  it('finds the earliest dinner on today\'s date only', () => {
    const days = [{ date: '2027-01-02', entries: [{ kind: 'dinner', time: '20:00' }, { kind: 'dinner', time: '18:00' }, { kind: 'tour', time: '09:00' }] }, { date: '2027-01-03', entries: [{ kind: 'dinner', time: '17:00' }] }]
    expect(tonightsDinner(days, '2027-01-02')).toBe('18:00')
    expect(tonightsDinner(days, '2027-01-04')).toBeNull()
  })
  it('formats a local date', () => {
    expect(localDate(new Date(2027, 0, 5, 12).getTime())).toBe('2027-01-05')
  })
})
