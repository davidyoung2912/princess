import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from './i18n/locales/en'

/** Source files of the app itself (not tests), read as text. */
function sources(dir = 'src'): { file: string; text: string }[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [{ file: path, text: readFileSync(path, 'utf8') }] : []
  })
}

const strings = Object.entries(en) as [string, string][]
const screens = sources().filter((s) => s.file.endsWith('.tsx'))

/**
 * Dark-pattern guard (XT-10, UX-02): every text in the app, and the screens that show it, must be free of pressure tactics.
 * Extends the offer-wording test in `domain/offers.test.ts` to the whole app.
 */
describe('no dark patterns anywhere in the app (XT-10)', () => {
  it('uses no false urgency or scarcity wording in any text', () => {
    const banned = /\b(hurry|last chance|selling fast|act now|don.t miss out|limited[- ]time (offer|only|deal)|running out of time|only \d+ (left|remaining)|almost gone|going fast|while (stocks|supplies) last|offer ends)\b/i
    for (const [k, v] of strings) expect(v, k).not.toMatch(banned)
  })

  it('never shames the choice to decline (confirm-shaming)', () => {
    const banned = /\bno thanks,? i (don.t|do not|hate|prefer)\b|\bi (don.t|do not) (want|like) (to )?(save|enjoy|be safe|have fun)\b|\bi.ll pay (more|full price)\b|\bmaybe later,? i like paying\b/i
    for (const [k, v] of strings) expect(v, k).not.toMatch(banned)
  })

  it('has no pre-ticked box or pre-chosen add-on in any screen', () => {
    for (const { file, text } of screens) {
      expect(text, file).not.toMatch(/defaultChecked/)
      expect(text, file).not.toMatch(/<input[^>]*type="checkbox"[^>]*checked=\{true\}/)
    }
  })

  it('has no countdown clock built into a screen that sells something', () => {
    for (const { file, text } of screens) {
      if (!/\/(book|ahead|offers|extras|aboard|plan)\//.test(file.replaceAll('\\', '/'))) continue
      expect(text, file).not.toMatch(/\b(secondsLeft|countdownTimer|timeLeft|useCountdown)\b/)
    }
  })

  it('does not hide a cost until later', () => {
    const banned = /\b(plus (taxes|fees) at checkout|additional fees may apply at checkout|hidden fee|surprise fee)\b/i
    for (const [k, v] of strings) expect(v, k).not.toMatch(banned)
  })

  it('says nothing renews by itself, and nothing in the text promises an auto-renewal', () => {
    expect(en['money.noRenew']).toBeTruthy()
    for (const [k, v] of strings) if (!k.startsWith('money.noRenew')) expect(v, k).not.toMatch(/\bauto-?renew(s|al|ing)?\b|\brenews automatically\b/i)
  })
})
