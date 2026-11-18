import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const guideKeys = Object.entries(en).filter(([k]) => k.startsWith('guide.'))

/** G7: what the plan's screens promise to every guest, held in the source so a later edit cannot quietly drop it. */
describe('the plan on screen', () => {
  const home = read('ui/home/StageGuide.tsx')
  const flow = read('ui/GuideFlow.tsx')

  it('says changes out loud in a polite live region, on Home and on the screens a step lives on', () => {
    expect(home).toMatch(/role="status"\s+aria-live="polite"/)
    expect(flow).toMatch(/aria-live="polite"/)
  })

  it('tells each task button apart for a screen reader, since several share the same visible words', () => {
    for (const k of ['guide.startTask', 'guide.laterFor', 'guide.skipFor', 'guide.restoreFor']) expect(en[k as keyof typeof en], k).toContain('{task}')
    expect(home).toMatch(/aria-label=\{t\('guide\.startTask'/)
    expect(home).toMatch(/(?:aria-label|describedAs)=\{t\('guide\.laterFor'/)
    expect(home).toMatch(/(?:aria-label|describedAs)=\{t\('guide\.skipFor'/)
  })

  it('never shows urgency or done by colour alone', () => {
    expect(home).toMatch(/guide__urgent[^\n]*\{t\('guide\.urgent'\)\}/)
    expect(home).toMatch(/visually-hidden[^\n]*guide\.done/)
    expect(home).toMatch(/aria-hidden="true"/)
  })

  it('lists the plan as headed sections and lists, not loose paragraphs', () => {
    expect(home).toMatch(/<section aria-label=\{t\('guide\.title'\)\}/)
    expect(home).toMatch(/aria-labelledby="guide-soon-h"/)
    expect(home).toMatch(/<ol className="stage-steps">/)
  })
})

describe('the words the plan uses', () => {
  it('has no empty text, no stray spaces, and no dash used as a pause', () => {
    for (const [k, v] of guideKeys) {
      const s = String(v)
      expect(s.trim(), k).not.toBe('')
      expect(s, k).toBe(s.trim())
      expect(s, k).not.toMatch(/ [—–] |--/)
      expect(s, k).not.toMatch(/\s{2,}/)
    }
  })

  it('writes every task why as one short plain sentence a guest can take in at a glance', () => {
    for (const [k, v] of guideKeys.filter(([k]) => /\.why$/.test(k))) {
      const s = String(v)
      expect(s.length, k).toBeLessThanOrEqual(220)
      expect(s, k).toMatch(/^[A-Z0-9“"‘']/)
    }
  })

  it('writes every task title as a short instruction, with no full stop', () => {
    for (const [k, v] of guideKeys.filter(([k]) => /\.title$/.test(k) && /^guide\.[a-zA-Z]+\.[a-zA-Z]+\.title$/.test(k))) {
      const s = String(v)
      expect(s.length, k).toBeLessThanOrEqual(60)
      expect(s, k).toMatch(/^[A-Z0-9]/)
      expect(s, k).not.toMatch(/\.$/)
    }
  })

  it('keeps every {placeholder} in the plan\'s own texts to the few the code fills in', () => {
    const known = new Set(['n', 'total', 'task', 'stage', 'done', 'count', 'date', 'moveOn', 'minutes', 'seen', 'skipped', 'port', 'names'])
    const own = guideKeys.filter(([k]) => /^guide\.(?:moveOn\.|[a-zA-Z]+\.[a-zA-Z]+\.(?:title|why)$)/.test(k) || /^guide\.[a-zA-Z]+$/.test(k))
    for (const [k, v] of own) for (const m of String(v).matchAll(/\{(\w+)\}/g)) expect(known.has(m[1]), `${k} {${m[1]}}`).toBe(true)
  })
})
