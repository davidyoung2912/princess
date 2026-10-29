import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Source files of the app itself (not tests), read as text for the guard checks below. */
function sources(dir = 'src'): { file: string; text: string }[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [{ file: path, text: readFileSync(path, 'utf8') }] : []
  })
}

const all = sources()

describe('security guards', () => {
  it('never writes markup or runs text as code', () => {
    for (const { file, text } of all) {
      expect(text, file).not.toMatch(/dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(/)
    }
  })

  it('opens every new-tab link with noreferrer', () => {
    for (const { file, text } of all) {
      for (const tag of text.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? []) expect(tag, file).toMatch(/rel="[^"]*noreferrer/)
    }
  })

  it('holds no API key in the source', () => {
    for (const { file, text } of all) expect(text, file).not.toMatch(/sk-ant-[A-Za-z0-9_-]{8,}/)
  })

  it('reads the concierge key only from the build environment', () => {
    const users = all.filter((s) => s.text.includes('ANTHROPIC_API_KEY')).map((s) => s.file)
    expect(users).toEqual([join('src', 'ai', 'concierge.ts')])
  })

  it('keeps the built page locked to its own origin, plus the two hosts it needs', () => {
    const config = readFileSync('vite.config.ts', 'utf8')
    const csp = config.slice(config.indexOf('const CSP = ['), config.indexOf('].join'))
    expect(csp).toContain(`"script-src 'self'"`)
    expect(csp).toContain(`"object-src 'none'"`)
    expect(csp).toContain(`"form-action 'none'"`)
    expect(csp).not.toMatch(/script-src[^"]*unsafe/)
    const hosts = [...csp.matchAll(/https:\/\/[^\s"';]+/g)].map((m) => m[0]).sort()
    expect(hosts).toEqual(['https://*.princess.com', 'https://api.anthropic.com'])
  })
})
