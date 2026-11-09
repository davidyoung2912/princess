// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeferredImage } from './DeferredImage'
import { updateSettings } from '../settings/store'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [] })
}

describe('OFF-06 image loading control', () => {
  it('loads a content photo normally, lazily', () => {
    updateSettings({ dataLight: false })
    const html = renderToStaticMarkup(<DeferredImage name="Sunset" src="/a.jpg" alt="Sunset" />)
    expect(html).toContain('<img')
    expect(html).toContain('loading="lazy"')
  })
  it('in data-light mode renders a button and no image tag, so nothing is fetched', () => {
    updateSettings({ dataLight: true })
    const html = renderToStaticMarkup(<DeferredImage name="Sunset" src="/a.jpg" alt="Sunset" />)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('/a.jpg')
    expect(html).toContain('Sunset')
    updateSettings({ dataLight: false })
  })
  it('the photo, chat and kept-picture screens all go through the deferral', () => {
    const read = (p: string) => readFileSync(p, 'utf8')
    expect(read('src/ui/extras/PhotosScreen.tsx')).not.toMatch(/<img /)
    expect(read('src/ui/onboard/ChatScreen.tsx')).not.toMatch(/<img /)
    expect(read('src/ui/media/Pictures.tsx')).toMatch(/settings\.dataLight/)
  })
  it('nothing autoplays: no autoPlay attribute, and play() only for the camera preview the guest starts', () => {
    for (const f of files('src')) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/autoPlay/i)
      // The only .play() calls are camera previews, which run after the guest taps to start the coach or the code scan.
      if (!f.endsWith('PhotoCoach.tsx') && !f.endsWith('DeviceTools.tsx')) expect(src, f).not.toMatch(/\.play\(\)/)
    }
  })
})
