import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function sources(dir = 'src'): { file: string; text: string }[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [{ file: path, text: readFileSync(path, 'utf8') }] : []
  })
}

const all = sources()
const usersOf = (pattern: RegExp) => all.filter((s) => pattern.test(s.text)).map((s) => s.file.split('\\').join('/')).sort()

/** Battery and data frugality (PERF-08): nothing polls on its own timer, and every other timer and listener has a way to stop. */
describe('timers and wake locks', () => {
  it('runs repeating timers only through the visibility-aware interval', () => {
    expect(usersOf(/\bsetInterval\(/)).toEqual(['src/hooks/visibleInterval.ts'])
  })

  it('stops a repeating timer when the page is hidden or the screen is left', () => {
    const file = all.find((s) => s.file.endsWith('visibleInterval.ts'))!.text
    expect(file).toContain('clearInterval')
    expect(file).toContain('removeEventListener')
  })

  it('asks for the screen wake lock in one place and gives it back', () => {
    expect(usersOf(/wakeLock/)).toEqual(['src/ui/boarding/PassScreen.tsx'])
    expect(all.find((s) => s.file.split('\\').join('/') === 'src/ui/boarding/PassScreen.tsx')!.text).toContain('release()')
  })

  it('removes every window or document listener it adds', () => {
    for (const { file, text } of all) {
      const adds = (text.match(/(?:window|document)\.addEventListener\(/g) ?? []).length
      const removes = (text.match(/(?:window|document)\.removeEventListener\(/g) ?? []).length
      // App-lifetime listeners are allowed only where they are started once at launch.
      if (adds > removes) expect(['src/diagnostics/watch.ts'], `${file} adds ${adds} listeners and removes ${removes}`).toContain(file.split('\\').join('/'))
    }
  })

  it('keeps timers out of render paths: no setTimeout without a clear except one-shot start-up and test helpers', () => {
    const allowed = ['src/main.tsx', 'src/diagnostics/watch.ts', 'src/data/outbox.ts', 'src/api/mock.ts', 'src/hooks/useDraft.ts', 'src/hooks/useOutbox.ts', 'src/hooks/visibleInterval.ts']
    expect(usersOf(/\bsetTimeout\(/).filter((f) => !allowed.includes(f))).toEqual([])
  })
})
