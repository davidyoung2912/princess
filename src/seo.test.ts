import { describe, expect, it } from 'vitest'
import { en } from './i18n/en'
import { ROUTES } from './routes/routes'
import { MAX_DESCRIPTION, MAX_TITLE, PUBLIC_PAGES, applyPageMeta, seoFor } from './seo'

describe('search and sharing tags (CNT-05)', () => {
  it('only lists real screens, each with a description of a good length', () => {
    for (const p of PUBLIC_PAGES) {
      expect(ROUTES.some((r) => r.path === p.path), p.path).toBe(true)
      const text = (en as Record<string, string>)[p.description]
      expect(text.length, p.path).toBeGreaterThan(50)
      expect(text.length, p.path).toBeLessThanOrEqual(MAX_DESCRIPTION)
    }
    expect(en['seo.private'].length).toBeLessThanOrEqual(MAX_DESCRIPTION)
  })

  it('keeps every account, booking and chat screen out of search', () => {
    for (const r of ROUTES) {
      const mine = r.tab === 'me' || r.tab === 'chat' || r.path.startsWith('/book') || r.path.startsWith('/plan') || r.path.startsWith('/ship') || /^\/home\/(check-in|boarding|embark|disembark|updates|medallion|luggage|find-pass)/.test(r.path)
      if (mine) expect(seoFor(r.path), r.path).toBeUndefined()
    }
    expect(seoFor('/home/cruise')?.description).toBe('seo.cruise')
  })

  it('writes the title, description, robots and share tags once, and updates them in place', () => {
    const made: { tag: string; attrs: Record<string, string> }[] = []
    const head = {
      querySelector: (sel: string) => made.find((m) => sel.includes(`"${m.attrs.name ?? m.attrs.property}"`)) ? { setAttribute: (k: string, v: string) => { made.find((m) => sel.includes(`"${m.attrs.name ?? m.attrs.property}"`))!.attrs[k] = v } } : null,
      appendChild: () => undefined,
    }
    const doc = {
      title: '',
      head,
      createElement: () => { const el = { tag: 'meta', attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v } }; made.push(el); return el },
    } as unknown as Document
    applyPageMeta(doc, { title: 'Sailings · Princess', description: 'A description', indexable: true, url: 'https://x.test/home/sailings' })
    applyPageMeta(doc, { title: 'Bill · Princess', description: 'Private', indexable: false, url: 'https://x.test/me/bill' })
    expect(doc.title).toBe('Bill · Princess')
    const get = (key: string) => made.filter((m) => m.attrs.name === key || m.attrs.property === key).map((m) => m.attrs.content)
    expect(get('robots')).toEqual(['noindex, nofollow'])
    expect(get('og:title')).toEqual(['Bill · Princess'])
    expect(get('og:url')).toEqual(['https://x.test/me/bill'])
    expect(MAX_TITLE).toBeGreaterThan(30)
  })
})
