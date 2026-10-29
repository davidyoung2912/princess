import type { StringKey } from './i18n'

/**
 * Search and sharing tags for public pages (CNT-05). This is a single-page app, so the tags in `index.html` are what a crawler or
 * link preview that does not run scripts sees; the tags set here on each change of screen serve those that do. Server rendering or
 * prerendering is not part of the concept: it needs a server (see the Phase 15 notes in the gap plan).
 * Only discovery pages are indexable. Everything that shows a person's booking or account is marked `noindex`.
 */
export interface SeoEntry { path: string; description: StringKey }

export const PUBLIC_PAGES: readonly SeoEntry[] = [
  { path: '/', description: 'seo.home' },
  { path: '/home/cruise', description: 'seo.cruise' },
  { path: '/home/sailings', description: 'seo.sailings' },
  { path: '/home/sailings/:id', description: 'seo.sailing' },
  { path: '/home/ports/:id', description: 'seo.port' },
  { path: '/home/ship', description: 'seo.ship' },
  { path: '/home/quiz', description: 'seo.quiz' },
]

export const seoFor = (pattern: string | undefined): SeoEntry | undefined => PUBLIC_PAGES.find((p) => p.path === pattern)

/** The title and description limits search results show before cutting the text off. */
export const MAX_TITLE = 60
export const MAX_DESCRIPTION = 160

export interface PageMeta { title: string; description: string; indexable: boolean; url: string }

const setMeta = (doc: Document, attr: 'name' | 'property', key: string, value: string) => {
  let el = doc.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) { el = doc.createElement('meta'); el.setAttribute(attr, key); doc.head.appendChild(el) }
  el.setAttribute('content', value)
}

/** Writes the title, description, robots and Open Graph tags for the current screen. */
export function applyPageMeta(doc: Document, meta: PageMeta): void {
  doc.title = meta.title
  setMeta(doc, 'name', 'description', meta.description)
  setMeta(doc, 'name', 'robots', meta.indexable ? 'index, follow' : 'noindex, nofollow')
  setMeta(doc, 'property', 'og:title', meta.title)
  setMeta(doc, 'property', 'og:description', meta.description)
  setMeta(doc, 'property', 'og:url', meta.url)
  setMeta(doc, 'name', 'twitter:title', meta.title)
  setMeta(doc, 'name', 'twitter:description', meta.description)
}
