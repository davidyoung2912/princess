import { describe, expect, it } from 'vitest'
import { t } from '../i18n'
import { screenHits } from '../routes/screenWords'
import { searchContent } from './searchIndex'

describe('search covers every screen', () => {
  const hits = screenHits(t)

  it('has a result for each screen when its own title is typed', () => {
    const missing = hits.filter((h) => h.title.trim().length >= 2 && !searchContent(h.title, hits).some((r) => r.to === h.to)).map((h) => `${h.to} (${h.title})`)
    expect(missing).toEqual([])
  })

  it('gives each screen at least one plain phrase beyond its title, so a guest can reach it without knowing its name', () => {
    const bare = hits.filter((h) => !(h.words ?? '').trim()).map((h) => h.to)
    expect(bare).toEqual([])
  })
})

describe('searching written answers', () => {
  it('finds help answers by their question or their text, with plurals and typos', async () => {
    const { searchAnswers } = await import('./searchIndex')
    const { helpAnswers } = await import('./answerDocs')
    const docs = helpAnswers()
    expect(searchAnswers('passport name', docs).map((d) => d.id)).toContain('help:name-mismatch')
    expect(searchAnswers('notifcations', docs).map((d) => d.id)).toContain('help:notifications')
    expect(searchAnswers('zzz qqq', docs)).toEqual([])
  })
})
