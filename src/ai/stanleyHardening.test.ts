import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'

/**
 * P12 hardening sweep (docs/stanley-launch-checklist.md): the checks of docs/stanley-actions-and-proactive-plan.md section 9 and the reminders document
 * section 27 that can be made from the source alone, run over every Stanley and reminder string at once, so a string added in a later phase cannot slip past.
 * The manual items (screen reader, 200% zoom, legal wording, S1 rehearsal, soak, chaos, training) are in the checklist, not here.
 */
const strings = en as unknown as Record<string, string>
const PREFIXES = ['stanley', 'autopilot', 'rem13.', 'reminders.', 'remindMe.']
const guestKeys = Object.keys(strings).filter((k) => PREFIXES.some((p) => k.startsWith(p)))
const text = (k: string): string => strings[k]

describe('P12 hardening: every guest-facing Stanley and reminder string', () => {
  it('finds the strings it is meant to sweep', () => {
    expect(guestKeys.length).toBeGreaterThan(4000)
  })

  it('never says "AI" as a word (D1, AC-X-01)', () => {
    expect(guestKeys.filter((k) => /\bAI\b/.test(text(k)))).toEqual([])
  })

  it('never carries a web link or an address a guest could be sent to (AC-X-02)', () => {
    expect(guestKeys.filter((k) => /https?:\/\/|\bwww\./i.test(text(k)))).toEqual([])
  })

  it('has no empty string, no leftover placeholder text and no doubled or stray spacing', () => {
    const bad = guestKeys.filter((k) => !text(k).trim() || /\b(TODO|FIXME|TBD|lorem ipsum|undefined|\[object Object\])\b/i.test(text(k)) || /  |\s$/.test(text(k)) || (/^\s/.test(text(k)) && !k.startsWith('rem13.tone.'))) // the tone captions are appended to a line, so they start with a space
    expect(bad).toEqual([])
  })

  it('opens and closes every {placeholder} it uses', () => {
    expect(guestKeys.filter((k) => (text(k).match(/\{/g) ?? []).length !== (text(k).match(/\}/g) ?? []).length)).toEqual([])
  })

  it('never promises a guarantee the plan does not give (reminders are an aid, never a replacement; decision 19)', () => {
    // Reminder wording only: "guarantee" is also a cabin fare type in the help library.
    const bad = guestKeys.filter((k) => /^(rem13\.|reminders\.|remindMe\.|stanleyReminders\.)/.test(k) && /\b(guarantee[sd]?|never miss|can'?t miss|you will not miss|100%)\b/i.test(text(k)) && !/\b(not|no|never) (a )?guarantee|not guaranteed|does not guarantee|cannot guarantee|can'?t guarantee\b/i.test(text(k)))
    expect(bad).toEqual([])
  })
})

describe('P12 hardening: the sources', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []))
  const files = [...walk('src/ai'), ...walk('src/ui/ai')]

  it('keeps no secret, key or token in a Stanley source file', () => {
    const bad = files.filter((f) => /sk-ant-[A-Za-z0-9_-]{10,}|\bBearer [A-Za-z0-9._-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY/.test(readFileSync(f, 'utf8')))
    expect(bad).toEqual([])
  })

  it('leaves no debugger statement or console.log in a Stanley source file', () => {
    const bad = files.filter((f) => /\bdebugger\b|console\.log\(/.test(readFileSync(f, 'utf8')))
    expect(bad).toEqual([])
  })

  it('does not let a Stanley screen write guest text to the console (nothing private in a log)', () => {
    const bad = files.filter((f) => /console\.(info|warn|error|debug)\(/.test(readFileSync(f, 'utf8')))
    expect(bad).toEqual([])
  })
})
