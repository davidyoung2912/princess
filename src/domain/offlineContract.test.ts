import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { ROUTES } from '../routes/routes'
import { OFFLINE_CONTRACT, offlineModeOf } from './offlineContract'

// proves: MOB-05#1, MOB-05#2, OFF-01#1, OFF-01#2
describe('offline contract', () => {
  it('has an entry for every registered route, and none for a route that is gone', () => {
    const paths = ROUTES.map((r) => r.path)
    expect(paths.filter((p) => !(p in OFFLINE_CONTRACT))).toEqual([])
    expect(Object.keys(OFFLINE_CONTRACT).filter((p) => !paths.includes(p))).toEqual([])
  })

  it('has a visible label for every mode', () => {
    for (const mode of new Set(Object.values(OFFLINE_CONTRACT))) expect((en as Record<string, string>)[`offline.mode.${mode}`]).toBeTruthy()
  })

  it('never claims an offline transaction: payments, booking and check-in need a connection', () => {
    for (const p of ['/book', '/book/pay/:id', '/me/payments', '/plan/cart', '/plan/prepay', '/home/check-in']) expect(offlineModeOf(p), p).toBe('needs-connection')
  })

  it('keeps safety screens usable with no signal', () => {
    for (const p of ['/ship/muster', '/ship/emergency', '/home/boarding-pass']) expect(offlineModeOf(p), p).toBe('offline')
  })

  it('treats an unknown route cautiously', () => {
    expect(offlineModeOf('/nowhere')).toBe('needs-connection')
  })
})
