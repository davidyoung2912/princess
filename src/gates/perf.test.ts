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
    expect(usersOf(/\bsetInterval\(/)).toEqual(['src/shared/hooks/visibleInterval.ts'])
  })

  it('stops a repeating timer when the page is hidden or the screen is left', () => {
    const file = all.find((s) => s.file.endsWith('visibleInterval.ts'))!.text
    expect(file).toContain('clearInterval')
    expect(file).toContain('removeEventListener')
  })

  it('asks for the screen wake lock in one place and gives it back', () => {
    expect(usersOf(/wakeLock/)).toEqual(['src/shared/hooks/useWakeLock.ts'])
    expect(all.find((s) => s.file.split('\\').join('/') === 'src/shared/hooks/useWakeLock.ts')!.text).toContain('release()')
  })

  it('removes every window or document listener it adds', () => {
    for (const { file, text } of all) {
      const adds = (text.match(/(?:window|document)\.addEventListener\(/g) ?? []).length
      const removes = (text.match(/(?:window|document)\.removeEventListener\(/g) ?? []).length
      // App-lifetime listeners are allowed only where they are started once at launch.
      if (adds > removes) expect(['src/shared/diagnostics/watch.ts'], `${file} adds ${adds} listeners and removes ${removes}`).toContain(file.split('\\').join('/'))
    }
  })

  it('keeps timers out of render paths: no setTimeout without a clear except one-shot start-up and test helpers', () => {
    const allowed = ['src/app/main.tsx', 'src/app/runtime/index.ts', 'src/shared/diagnostics/watch.ts', 'src/shared/data/outbox.ts', 'src/shared/api/mock.ts', 'src/shared/api/http.ts', 'src/shared/auth/httpProvider.ts', 'src/features/chat/hooks/useChatSummary.ts', 'src/shared/hooks/useDraft.ts', 'src/shared/hooks/useOutbox.ts', 'src/shared/hooks/useRecentVisit.ts', 'src/shared/hooks/useSavedCopy.ts', 'src/shared/hooks/useServedFeeds.ts', 'src/shared/hooks/visibleInterval.ts', 'src/shared/sync/sync.ts', 'src/shared/sync/portRows.ts', 'src/shared/push/browser.ts', 'src/features/chat/realtime/hubClient.ts', 'src/features/onboard/ui/DeviceTools.tsx', 'src/shared/ui/ChatToast.tsx', 'src/features/chat/hooks/useChatDnd.ts', 'src/shared/hooks/useLongPress.ts', 'src/features/chat/ui/ChatConversations.tsx', 'src/features/chat/ui/ChatMessages.tsx', 'src/features/chat/ui/ChatConversationList.tsx', 'src/features/chat/ui/ChatThreadMenus.tsx', 'src/features/explorer/ui/games/WordleScreen.tsx']
    expect(usersOf(/\bsetTimeout\(/).filter((f) => !allowed.includes(f))).toEqual([])
  })
})
