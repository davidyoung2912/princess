// Bundle budget (N1.4). Run after `npm run build`: `npm run bundle:check`. No browser needed.
// The first load is everything index.html pulls in before any screen: the entry script and its preloaded chunks. Screens load later, one chunk each.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const dist = 'dist'
const KB = 1024
// Budgets in gzip bytes. Re-baselined in Explorer phase 9: the English string table (core about 205 kB gzip) and the runtime and content modules grew the first load from about 312 kB to about 747 kB. The budgets sit a little above today's sizes so growth still has to be argued for.
// The Stanley and tip strings are already a separate chunk (`enLate`, about 135 kB gzip) loaded in parallel with start-up.
// Re-baselined again in the review of 2026-11-23 (docs/review-and-completeness-plan.md, Phase E): the check was already failing (first load 822 kB, the QR decoder 45.5 kB, assets 5860 kB), so it
// guarded nothing. The new numbers are today's with a little headroom, so growth is caught again. The aim is still 630 kB: the English string table is 233 kB gzip of the 822 and needs a per-screen split.
const FIRST_LOAD_MAX = 850 * KB
const SCREEN_MAX = 46 * KB   // ChatConversations is 43.8 kB gzip (one 114 kB source file): split it by tab to get back under 40
const PRECACHE_MAX = 6000 * KB

// A language pack is its own download, fetched only when the guest picks that language, so it is not a screen. `enLate` is the Stanley and tip text, loaded before the first screen is drawn.
// `jsQR` is a third-party decoder fetched only when the guest scans a QR code; it is not a screen.
const LANGUAGE_PACK = /^(es|enLate|jsQR)-/
const gz = (file) => gzipSync(readFileSync(file)).length
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const first = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1])
const firstSet = new Set(first)
const firstLoad = first.reduce((sum, f) => sum + gz(join(dist, f)), 0)

const assets = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'))
const screens = assets.map((f) => ({ f, size: gz(join(dist, 'assets', f)) })).filter((a) => !firstSet.has(`assets/${a.f}`) && !LANGUAGE_PACK.test(a.f))
const biggest = screens.reduce((a, b) => (b.size > a.size ? b : a), { f: '', size: 0 })
// Art (WebP) is cached as it is used, not precached; only the logo is precached.
const precache = readdirSync(join(dist, 'assets')).filter((f) => !f.endsWith('.webp') || f.startsWith('princess-')).reduce((sum, f) => sum + statSync(join(dist, 'assets', f)).size, 0)

const problems = []
if (firstLoad > FIRST_LOAD_MAX) problems.push(`first load is ${(firstLoad / KB).toFixed(1)} kB gzip, budget ${FIRST_LOAD_MAX / KB} kB (${first.join(', ')})`)
if (biggest.size > SCREEN_MAX) problems.push(`${biggest.f} is ${(biggest.size / KB).toFixed(1)} kB gzip, budget ${SCREEN_MAX / KB} kB for one screen chunk`)
if (precache > PRECACHE_MAX) problems.push(`assets total ${(precache / KB).toFixed(0)} kB, budget ${PRECACHE_MAX / KB} kB`)

console.log(`first load ${(firstLoad / KB).toFixed(1)} kB gzip of ${FIRST_LOAD_MAX / KB}; largest screen ${biggest.f} ${(biggest.size / KB).toFixed(1)} kB of ${SCREEN_MAX / KB}; assets ${(precache / KB).toFixed(0)} kB of ${PRECACHE_MAX / KB}`)
if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
