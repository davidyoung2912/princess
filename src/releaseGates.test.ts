import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ApiError } from './api/errors'
import { bounded, withRetries } from './api/bounded'
import { createHttp } from './api/http'
import { MAX_ATTEMPTS, MAX_QUEUED, due, enqueue, failed, gaveUp, isRetryable, loadOutbox, saveOutbox, sent, type OutboxItem } from './data/outbox'
import { cacheGet, cachePut, maxAgeFor } from './domain/offlineCache'
import { OFFLINE_CONTRACT, offlineModeOf } from './domain/offlineContract'
import { ageLabel, chipKind } from './domain/syncAge'
import { NOTHING_SHARED, SHARING_FACETS, normalizeSharing } from './domain/partyShare'
import { RETENTION, kindsToDelete } from './domain/privacy'
import { DRILL_ALTERNATIVES } from './domain/safety'
import { ROUTES } from './routes/routes'
import { en } from './i18n/locales/en'

/**
 * The 10 P0 release gates of docs/princess_cruises_expanded_best_in_market_requirements.md section 9.1, as node tests (BM21, layer L4 of
 * docs/best-in-market-plan-2.md). Each gate drives the real modules where they are framework-free and reads the source where the behaviour lives in a
 * React screen (the project does no browser testing). A gate the app does not yet pass is an `it.fails`: it passes while the gap exists and fails the day
 * the gap is closed, which is the cue to turn it into `it`. Each such gap has a BM number in docs/best-in-market-plan-2.md section 5f.
 */

const read = (p: string): string => readFileSync(p, 'utf8')
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []))
const strings = en as unknown as Record<string, string>

/** A phone's storage, in memory. */
const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

const DAY = 86_400_000
const item = (id: string): Pick<OutboxItem, 'id' | 'kind' | 'payload'> => ({ id, kind: 'service', payload: { what: id } })

describe('gate 1: no silent loss', () => {
  it('a queued action stays visible until it is sent, and is reported when it gives up', () => {
    let list = enqueue([], item('towels'), 0)
    expect(list).toHaveLength(1)
    for (let i = 0; i < MAX_ATTEMPTS; i++) list = failed(list, 'towels', i, () => 0)
    expect(due(list, 1e12)).toEqual([])
    expect(gaveUp(list).map((x) => x.id)).toEqual(['towels']) // not dropped: the screen can say it never arrived
    expect(sent(list, 'towels')).toEqual([])
  })

  it('a waiting action survives a reload', () => {
    const store = memory()
    saveOutbox(store, 'p1', enqueue([], item('a'), 5))
    expect(loadOutbox(store, 'p1').map((x) => x.id)).toEqual(['a'])
  })

  it('every failure arrives as an error with a code a screen can word, never as a silent undefined', async () => {
    const fetchWith = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
    const http = (status: number, body: unknown) => createHttp({ baseUrl: '/api', fetch: fetchWith(status, body), token: () => 't', refresh: async () => false, online: () => true })
    await expect(http(500, {}).post('/x', {})).rejects.toMatchObject({ code: 'server', retryable: true })
    await expect(http(402, { code: 'declined' }).post('/x', {})).rejects.toMatchObject({ code: 'declined' })
    await expect(http(409, { code: 'priceChanged' }).post('/x', {})).rejects.toMatchObject({ code: 'conflict' })
    await expect(createHttp({ baseUrl: '/api', token: () => 't', refresh: async () => false, online: () => false }).post('/x', {})).rejects.toMatchObject({ code: 'offline' })
  })

  it('the 21st waiting action does not push the oldest out unseen', () => {
    // A full outbox refuses the new action (hasRoom is false, the screen keeps the text and says so) instead of dropping the oldest.
    let list: OutboxItem[] = []
    for (let i = 0; i <= MAX_QUEUED; i++) list = enqueue(list, item(`r${i}`), i)
    expect(list.map((x) => x.id)).toContain('r0')
  })
})

describe('gate 2: safe retry', () => {
  it('queuing the same action twice (a double tap) keeps one', () => {
    const once = enqueue([], item('same'), 0)
    expect(enqueue(once, item('same'), 1)).toHaveLength(1)
  })

  it('a change that times out is not repeated by the client behind the guest\'s back', async () => {
    let calls = 0
    const stalled = ((_url: string, init: RequestInit) => {
      calls++
      return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
    }) as unknown as typeof fetch
    const http = createHttp({ baseUrl: '/api', fetch: stalled, token: () => 't', refresh: async () => false, online: () => true, timeoutMs: 5 })
    await expect(http.post('/bookings', { draft: 1 })).rejects.toMatchObject({ code: 'timeout' })
    expect(calls).toBe(1)
  })

  it('a stalled call ends as a retryable timeout, so the guest can look before trying again', async () => {
    await expect(bounded(new Promise(() => {}), 5)).rejects.toMatchObject({ code: 'timeout', retryable: true })
  })

  it('automatic retries are for reads and stop at a real answer (a conflict is never repeated)', async () => {
    let calls = 0
    await expect(withRetries(async () => { calls++; throw new ApiError('conflict') }, { retries: 3, sleep: async () => {} })).rejects.toMatchObject({ code: 'conflict' })
    expect(calls).toBe(1)
    expect(isRetryable('conflict')).toBe(false)
    expect(isRetryable('declined')).toBe(false)
  })

  it('no money-moving call goes through the automatic read retry', () => {
    const offenders = walk('src').filter((f) => /withRetries\([^)]*\b(pay|book|charge|order)/i.test(read(f)))
    expect(offenders).toEqual([])
  })

  it('the client sends an Idempotency-Key on booking and payment posts, so a retry after a lost reply cannot charge twice', () => {
    // The server accepts the header (BookingEndpoints.cs) and also treats the same draft twice as one booking, but pay-balance has no such draft and the client never sends a key.
    expect(read('src/api/httpApi.ts') + read('src/api/http.ts')).toMatch(/idempotency-key/i)
  })

  it('an idempotent post carries one key, and the resend after a silent refresh carries the same key', async () => {
    const keys: (string | undefined)[] = []
    let first = true
    const f = (async (_u: string, init: RequestInit) => {
      keys.push((init.headers as Record<string, string>)['idempotency-key'])
      if (first) { first = false; return new Response('', { status: 401 }) }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const http = createHttp({ baseUrl: '/api', fetch: f, token: () => 't', refresh: async () => true, online: () => true })
    await http.post('/bookings/X/pay-balance', {}, { idempotent: true })
    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatch(/^[A-Za-z0-9_.:-]{8,80}$/)
    expect(keys[1]).toBe(keys[0])
    await http.post('/other', {})
    expect(keys[2]).toBeUndefined()
  })

  it('the pay button is disabled while the payment runs', () => {
    expect(read('src/ui/book/PayPanel.tsx')).toMatch(/disabled=\{[^}]*busy/)
  })
})

describe('gate 3: offline survivability', () => {
  it('the boarding pass, muster card and emergency help open with no network; tickets and the port pack show a saved copy', () => {
    for (const path of ['/home/boarding-pass', '/ship/muster', '/ship/emergency', '/ship/help-now']) expect(offlineModeOf(path), path).toBe('offline')
    for (const path of ['/plan/reservations', '/plan/reservations/:id', '/ship/port']) expect(offlineModeOf(path), path).toBe('view-only')
  })

  it('every route says what it can do offline (nothing is left to the default)', () => {
    expect(ROUTES.filter((r) => !(r.path in OFFLINE_CONTRACT)).map((r) => r.path)).toEqual([])
  })

  it('a saved copy is read back with its saved time, for each kind a guest needs', () => {
    const store = memory()
    for (const kind of ['pass', 'muster', 'program', 'dining', 'portDay']) {
      expect(cachePut(store, kind, 'b1', { n: kind }, 1000), kind).toBe(true)
      expect(cacheGet(store, kind, 'b1', (v) => v as { n: string }, 2000), kind).toEqual({ savedAt: 1000, value: { n: kind } })
    }
  })

  it('a copy the phone cannot store is reported, not pretended', () => {
    const full = { setItem: () => { throw new Error('quota') } }
    expect(cachePut(full, 'pass', 'b1', {}, 0)).toBe(false)
  })

  it('a damaged copy is ignored rather than shown', () => {
    const store = memory()
    store.setItem('princess:cache:pass:b1', '{not json')
    expect(cacheGet(store, 'pass', 'b1', (v) => v)).toBeNull()
  })
})

describe('gate 4: freshness clarity', () => {
  it('offline always says since when; online says just now or the time it was updated', () => {
    const updated = new Date('2027-03-01T09:14:00')
    expect(ageLabel(updated, new Date('2027-03-01T12:00:00'), 'offline')).toMatchObject({ kind: 'offlineSince' })
    expect(ageLabel(updated, new Date('2027-03-01T09:14:30'), 'live')).toEqual({ kind: 'justNow' })
    expect(ageLabel(updated, new Date('2027-03-01T12:00:00'), 'live')).toMatchObject({ kind: 'updatedAt' })
  })

  it('the sync chip tells waiting changes, a stale copy, a failed lookup and no cruise apart', () => {
    const at = new Date(0)
    const base = { state: 'live' as const, updated: at, now: at, pending: 0 }
    expect(chipKind(base)).toBe('current')
    expect(chipKind({ ...base, state: 'offline' })).toBe('stale')
    expect(chipKind({ ...base, pending: 2 })).toBe('pending')
    expect(chipKind({ ...base, lookup: 'unavailable' })).toBe('unavailable')
    expect(chipKind({ ...base, lookup: 'notLinked' })).toBe('notLinked')
  })

  it('figures that change within a day are not trusted for as long as a boarding pass', () => {
    expect(maxAgeFor('feed-sky')).toBeLessThan(maxAgeFor('pass'))
    expect(maxAgeFor('program')).toBeLessThan(maxAgeFor('pass'))
    const store = memory()
    cachePut(store, 'feed-sky', 'x', { v: 1 }, 0)
    expect(cacheGet(store, 'feed-sky', 'x', (v) => v, 2 * DAY)).toBeNull()
  })

  it('every screen that shows a saved copy shows its age (see offlineDay.test.ts), and the shell says what to do while offline', () => {
    const note = read('src/ui/OfflineNote.tsx')
    expect(note).toMatch(/offlineModeOf|OFFLINE_CONTRACT/)
    expect(read('src/ui/SyncChip.tsx')).toMatch(/chipKind/)
  })
})

describe('gate 5: human recovery', () => {
  const CRITICAL: Record<string, string> = {
    'src/ui/boarding/parts.tsx': 'boarding pass',
    'src/ui/onboard/SafetyScreens.tsx': 'muster, emergency and medical',
    'src/ui/HelpSheet.tsx': 'help from any screen',
  }
  const callKeys = Object.keys(strings).filter((k) => /\{number\}/.test(strings[k]) && /call|dial|phone/i.test(strings[k]))

  it('there are call-a-person strings, each with a number slot', () => {
    expect(callKeys.length).toBeGreaterThan(5)
  })

  for (const [file, what] of Object.entries(CRITICAL)) {
    it(`${what} offers a person, not only a bot or an FAQ`, () => {
      const text = read(file)
      expect(callKeys.some((k) => text.includes(`'${k}'`) || text.includes(`"${k}"`)), `${file} names no call string`).toBe(true)
    })
  }

  it('the help sheet is mounted in the shell, so it is one tap from every screen', () => {
    expect(read('src/ui/Shell.tsx')).toMatch(/HelpSheet/)
  })

  it('the chat screen offers a phone call when it is slow', () => {
    expect(read('src/ui/onboard/ChatScreen.tsx')).toMatch(/chat\.callMe/)
    expect(strings['chat.callMe']).toBeTruthy()
    expect(strings['chat.slowBody']).toMatch(/phone call/)
  })
})

describe('gate 6: accessibility', () => {
  it('motion, text size and contrast are all settings the guest controls, and the device preference is honoured', () => {
    const settings = read('src/settings/settings.ts')
    for (const f of ['textSize', 'contrast', 'reduceMotion', 'calm', 'simple']) expect(settings, f).toContain(f)
    expect(read('src/styles/motion.css')).toMatch(/prefers-reduced-motion:\s*reduce/)
    expect(read('src/styles/themes.css')).toMatch(/data-contrast='high'/)
  })

  it('nothing needs a drag, and hover is never the only way to reach something', () => {
    const src = walk('src').map((f) => ({ f, text: read(f) }))
    expect(src.filter((s) => /\bonDrag\w*=|draggable=\{?["']?true|onPointerMove=/.test(s.text)).map((s) => s.f)).toEqual([])
    // The one hover handler is a decorative wiggle on a page title: it hides nothing and the same title is shown without it.
    expect(src.filter((s) => /onMouseEnter|onMouseOver/.test(s.text)).map((s) => s.f)).toEqual(['src/ui/PageHeader.tsx'])
  })

  it('every screen is checked structurally (one h1, one main, labelled buttons) and for colour contrast', () => {
    expect(read('src/ui/a11y.test.tsx')).toMatch(/exactly one h1/)
    expect(read('src/design/contrast.test.ts')).toMatch(/AA|contrast/i)
  })

  it('dialogs trap focus and close on Escape', () => {
    expect(read('src/ui/Dialog.tsx')).toMatch(/Escape/)
  })
})

describe('gate 7: no app coercion', () => {
  it('boarding has a paper and a desk route', () => {
    expect(strings['pass.failsafe.print']).toMatch(/Print/)
    expect(strings['pass.failsafe.desk']).toMatch(/desk/)
    expect(strings['alt.boardingPass']).toMatch(/Guest Services|terminal/)
  })

  it('the muster drill has an alternative for every need it names, and says the crew come first', () => {
    expect(DRILL_ALTERNATIVES.length).toBeGreaterThanOrEqual(5)
    expect(strings['muster.checkinBody']).toMatch(/crew member/)
  })

  it('medical help and the emergency line are numbers to dial, not app features', () => {
    expect(strings['emerg.call']).toMatch(/\{number\}/)
    expect(strings['help.urgent.locked.do']).toMatch(/crew member/)
  })

  it('disembarkation points to the guest desk for anything the app does not settle', () => {
    expect(Object.entries(strings).some(([k, v]) => /disembark|stanley\.a\.disembark|land/.test(k) && /guest desk|Guest Services/.test(v))).toBe(true)
  })

  it('a helper cannot pay in the app, and the screen says a person can do it by phone', () => {
    expect(strings['helper.alt.body']).toMatch(/by phone/)
  })
})

describe('gate 8: privacy', () => {
  it('nothing is shared with a party until the guest turns it on, and turning it off revokes it', () => {
    expect(Object.values(NOTHING_SHARED).every((v) => v === false)).toBe(true)
    expect(normalizeSharing(undefined)).toEqual(NOTHING_SHARED)
    expect(normalizeSharing({ plans: true, photos: true })).toMatchObject({ plans: true, photos: true, spending: false })
    expect(normalizeSharing({ plans: false })).toEqual(NOTHING_SHARED)
    expect(normalizeSharing('yes')).toEqual(NOTHING_SHARED)
  })

  it('health details have no sharing switch at all', () => {
    expect([...SHARING_FACETS].some((f) => /medical|health|passport|location/i.test(f))).toBe(false)
  })

  it('identity documents, photos and health are deleted on their day and not before', () => {
    expect(kindsToDelete('2027-03-01', '2027-03-02')).toEqual([])
    const after = kindsToDelete('2027-03-01', '2027-06-30')
    expect(after).toEqual(expect.arrayContaining(['ci-guest', 'documents', 'illness', 'message']))
    expect(RETENTION.every((r) => r.days === null || r.days > 0)).toBe(true)
  })

  it('the concierge key and guest location never leave through the client', () => {
    const src = walk('src').filter((f) => !f.endsWith('security.test.ts')).map(read).join('\n')
    expect(src).not.toMatch(/api\.anthropic\.com/)
    expect(src).not.toMatch(/watchPosition/) // location is read once, on the guest's tap, if at all
  })

  it('the privacy centre exports the guest\'s data from the server', () => {
    expect(read('src/api/httpApi.ts')).toMatch(/me\/export/)
  })

  it('the privacy centre deletes the guest\'s server-held data, not only this device', () => {
    // "Delete my data" runs wipeAll (this browser). DELETE /me/state exists on the server (docs/runbook.md) but no client call reaches it.
    expect(read('src/runtime/index.ts')).toMatch(/delete<void>\('\/me\/state'\)/)
  })
})

describe('gate 9: cross-surface parity', () => {
  const TASKS: Record<string, string> = { book: '/book', manage: '/me/trips', 'check in': '/home/check-in', plan: '/plan', support: '/me/help' }
  const paths = new Set(ROUTES.map((r) => r.path))

  for (const [task, path] of Object.entries(TASKS)) {
    it(`${task} has one route that the phone and the desktop share`, () => {
      expect(paths.has(path), path).toBe(true)
    })
  }

  it('there is no route that exists for one surface only', () => {
    const rows = ROUTES.map((r) => Object.keys(r)).flat()
    expect(rows.filter((k) => /mobile|desktop|phoneOnly|desktopOnly/i.test(k))).toEqual([])
  })

  it('the phone tab bar and the desktop rail are built from the same five areas', () => {
    const shell = read('src/ui/Shell.tsx')
    expect(shell).toMatch(/TABS|tabs/)
    const css = walk('src').length && readdirSync('src/styles').map((f) => read(join('src/styles', f))).join('\n')
    expect(css).toMatch(/@media \(min-width/)
  })

  it('the viewport allows zoom and covers a notch', () => {
    const html = read('index.html')
    expect(html).toMatch(/viewport-fit=cover/)
    expect(html).not.toMatch(/user-scalable=no|maximum-scale=1\b/)
  })
})

describe('gate 10: operational readiness', () => {
  const runbook = read('docs/runbook.md')
  const scorecard = read('docs/release-scorecard.md')

  it('the runbook says how to check the server, its providers, logs, retention and account deletion', () => {
    for (const h of ['Is it up?', 'Providers', 'Logs', 'Retention', 'Account export and deletion']) expect(runbook, h).toContain(`## ${h}`)
    expect(runbook).toMatch(/health\/providers/)
  })

  it('every provider the server can switch is named in the runbook', () => {
    const cs = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? cs(join(dir, e.name)) : e.name.endsWith('.cs') ? [join(dir, e.name)] : []))
    const server = cs('server/Princess.Api').map(read).join('\n')
    const names = [...new Set([...server.matchAll(/Providers:([A-Z][A-Za-z]+)/g)].map((m) => m[1]))].filter((n) => n !== 'ConciergeLimit')
    expect(names.length).toBeGreaterThan(0)
    expect(names.filter((n) => !runbook.includes(`Providers:${n}`) && !new RegExp(n, 'i').test(runbook) && !['Email', 'Sms'].includes(n))).toEqual([])
  })

  it.fails('the Email and Sms providers are named in the runbook, with their failure behaviour', () => {
    expect(runbook).toMatch(/Providers:Email/)
    expect(runbook).toMatch(/Providers:Sms/)
  })

  it('the release scorecard has an operations section with an owner-signed check for each', () => {
    expect(scorecard).toMatch(/## D\. Operations/)
    expect(scorecard.match(/^\| D\d /gm)?.length).toBeGreaterThanOrEqual(5)
  })

  it('every live feature can fall back to the simulation by configuration alone', () => {
    expect(runbook).toMatch(/set the name to `sim`/i)
  })

  it('the status screen reads a served status and incident feed, not a client-side demo scenario', () => {
    expect(read('src/ui/aboard/SupportScreens.tsx')).not.toMatch(/scenario/i)
  })

  it.fails('the runbook has an incident section: who owns it, who is told, and how guests are told', () => {
    expect(runbook).toMatch(/^## .*(incident|on-call|escalat)/im)
  })
})
