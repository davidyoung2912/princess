import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { STAGE_IDS } from './sailings'
import { PHONE_STEPS, normalizeDone, roamingMoment, toggleStep, wifiAdvice } from './phoneSetup'

describe('phone setup (XT-01, S3-07)', () => {
  it('has words for every step and reminder', () => {
    for (const s of PHONE_STEPS) { expect((en as Record<string, string>)[`phone.step.${s.id}`], s.id).toBeTruthy(); expect((en as Record<string, string>)[`phone.step.${s.id}.why`], s.id).toBeTruthy() }
    for (const m of ['beforeSailing', 'sailAway', 'atSea', 'inPort']) { expect((en as Record<string, string>)[`phone.moment.${m}`], m).toBeTruthy(); expect((en as Record<string, string>)[`phone.moment.${m}.body`], m).toBeTruthy() }
  })

  it('picks a reminder for each stage, none before booking is real or after the cruise', () => {
    expect(roamingMoment('preCruise')).toBe('beforeSailing')
    expect(roamingMoment('embarkation')).toBe('sailAway')
    expect(roamingMoment('seaDay')).toBe('atSea')
    expect(roamingMoment('belize')).toBe('inPort')
    expect(roamingMoment('postCruise')).toBe('none')
    expect(roamingMoment('booked')).toBe('none')
    for (const s of STAGE_IDS) expect(['none', 'beforeSailing', 'sailAway', 'atSea', 'inPort']).toContain(roamingMoment(s))
  })

  it('keeps a clean list of ticked steps', () => {
    expect(normalizeDone(null)).toEqual([])
    expect(normalizeDone(['roaming', 'roaming', 'nonsense', 4])).toEqual(['roaming'])
    expect(toggleStep([], 'wifi')).toEqual(['wifi'])
    expect(toggleStep(['wifi'], 'wifi')).toEqual([])
  })
})

describe('Wi-Fi coach', () => {
  it('is fine below 80% of the cap, near from 80%, over beyond it', () => {
    expect(wifiAdvice('messaging', 100)).toMatchObject({ level: 'fine', upgradeTo: null })
    expect(wifiAdvice('messaging', 400)).toMatchObject({ level: 'near', percent: 80, upgradeTo: 'surf' })
    expect(wifiAdvice('messaging', 501)).toMatchObject({ level: 'over', upgradeTo: 'surf' })
  })

  it('has nothing to say about an unlimited plan, and no step above the top capped plan beyond unlimited', () => {
    expect(wifiAdvice('stream', 9999)).toEqual({ level: 'unlimited', percent: 0, upgradeTo: null })
    expect(wifiAdvice('surf', 2900).upgradeTo).toBe('stream')
  })
})
