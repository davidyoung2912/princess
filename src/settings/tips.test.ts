// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { SCREEN_LIST } from '../routes/screens'
import { ALL_TAB_KEYS } from '../routes/stageNav'
import { en } from '../i18n/locales/en'
import { dismissTip, hasTip, loadTipProgress, resetTips, tipCount, tipIdFor, tipKeyAt } from './tips'

describe('traveller tips', () => {
  beforeEach(() => { localStorage.clear(); resetTips() })

  it('has a tip for every screen that shows the shell, and for every tab landing page', () => {
    // X07 is the one-time stage welcome, which is itself the guidance.
    const publicIds = ['X01', 'X02', 'X03', 'X04', 'X07']
    expect(SCREEN_LIST.filter((s) => !publicIds.includes(s.id) && !hasTip(s.id)).map((s) => s.id)).toEqual([])
    expect(ALL_TAB_KEYS.filter((k) => !hasTip(`tab.${k}`))).toEqual([])
  })

  it('numbers every page\'s tips without gaps, and every tip belongs to a real page', () => {
    const ids = new Set([...SCREEN_LIST.map((s) => s.id), ...ALL_TAB_KEYS.map((k) => `tab.${k}`)])
    const tips = Object.keys(en).filter((k) => k.startsWith('tip.') && !['tip.label', 'tip.gotIt', 'tip.count'].includes(k))
    const orphans = tips.filter((k) => { const m = /^tip\.(.+?)(?:\.(\d+))?$/.exec(k); return !m || !ids.has(m[1]!) })
    expect(orphans).toEqual([])
    const gaps = tips.filter((k) => { const m = /^tip\.(.+?)\.(\d+)$/.exec(k); return m && !hasTip(m[1]!, Number(m[2]) - 1) })
    expect(gaps).toEqual([])
  })

  it('gives every page at least two tips', () => {
    const ids = [...SCREEN_LIST.map((s) => s.id).filter((id) => !['X01', 'X02', 'X03', 'X04', 'X07'].includes(id)), ...ALL_TAB_KEYS.map((k) => `tab.${k}`)]
    expect(ids.filter((id) => tipCount(id) < 2)).toEqual([])
  })

  it('keeps tips short enough for one or two lines', () => {
    expect(Object.entries(en).filter(([k, v]) => k.startsWith('tip.') && k !== 'tip.count' && v.length > 200).map(([k]) => k)).toEqual([])
  })

  it('names the first tip by the id and the rest by number', () => {
    expect(tipKeyAt('H02', 1)).toBe('tip.H02')
    expect(tipKeyAt('H02', 3)).toBe('tip.H02.3')
    expect(tipIdFor('H02', undefined)).toBe('H02')
    expect(tipIdFor(undefined, 'plan')).toBe('tab.plan')
    expect(tipIdFor(undefined, undefined)).toBeNull()
  })

  it('remembers each dismissal in the browser, stops at the last tip, and forgets on reset', () => {
    dismissTip('H02')
    dismissTip('H02')
    expect(loadTipProgress()).toEqual({ H02: 2 })
    expect(JSON.parse(localStorage.getItem('princess.dismissedTips') ?? '{}')).toEqual({ H02: 2 })
    for (let i = 0; i < 20; i++) dismissTip('H02')
    expect(loadTipProgress().H02).toBe(tipCount('H02'))
    resetTips()
    expect(loadTipProgress()).toEqual({})
  })
})
