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

  it('keeps the concierge key off the device: no front-end file reads it or calls the model host', () => {
    const others = all.filter((s) => s.file !== join('src', 'gates', 'security.test.ts'))
    expect(others.filter((s) => s.text.includes('ANTHROPIC_API_KEY')).map((s) => s.file)).toEqual([])
    expect(others.filter((s) => s.text.includes('api.anthropic.com')).map((s) => s.file)).toEqual([])
  })

  it('keeps the built page locked to its own origin, plus the one host it needs', () => {
    const config = readFileSync('vite.config.ts', 'utf8')
    const csp = config.slice(config.indexOf('const cspFor = '), config.indexOf('].join'))
    expect(csp).toContain(`"script-src 'self'"`)
    expect(csp).toContain(`"object-src 'none'"`)
    expect(csp).toContain(`"form-action 'none'"`)
    expect(csp).not.toMatch(/script-src[^"]*unsafe/)
    const hosts = [...csp.matchAll(/https:\/\/[^\s"';`$]+/g)].map((m) => m[0]).sort()
    expect(hosts).toEqual(['https://*.princess.com'])
  })
})

describe('static host headers (docs/static-host-headers.md)', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
  const all = new Map(config.headers.find((h) => h.source === '/(.*)')!.headers.map((h) => [h.key, h.value]))

  it('sends the security headers the document lists on every response', () => {
    expect(all.get('Strict-Transport-Security')).toMatch(/max-age=\d{8,}/)
    expect(all.get('X-Frame-Options')).toBe('DENY')
    expect(all.get('X-Content-Type-Options')).toBe('nosniff')
    expect(all.get('Referrer-Policy')).toBe('no-referrer')
    expect(all.get('Permissions-Policy')).toContain('microphone=()')
  })

  it('caches hashed assets for a year and never caches the page or the service worker', () => {
    const rule = (source: string) => config.headers.find((h) => h.source === source)?.headers[0].value
    expect(rule('/assets/(.*)')).toContain('immutable')
    expect(rule('/(index.html|sw.js|registerSW.js|manifest.webmanifest)')).toBe('no-cache')
  })
})

describe('responsible disclosure (SEC-10)', () => {
  const txt = readFileSync('public/.well-known/security.txt', 'utf8')
  it('has the fields RFC 9116 requires and a policy page that exists', () => {
    expect(txt).toMatch(/^Contact: mailto:\S+$/m)
    expect(txt).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T/m)
    const policy = /^Policy: (\S+)$/m.exec(txt)?.[1]
    expect(policy).toBe('/security-policy.html')
    expect(statSync('public/security-policy.html').isFile()).toBe(true)
  })
  it('matches the text the server sends', () => {
    const cs = readFileSync('server/Princess.Api/Endpoints/SecurityTxtEndpoint.cs', 'utf8')
    // The server's contact comes from `Security:Contact`; its default is the same placeholder this file carries.
    for (const line of txt.trim().split('\n')) {
      if (line.startsWith('Contact: ')) expect(cs).toContain(`PlaceholderContact = "${line.slice('Contact: '.length)}"`)
      else expect(cs).toContain(line)
    }
  })
})
