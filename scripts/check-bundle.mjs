// Bundle budget (N1.4). Run after `npm run build`: `npm run bundle:check`. No browser needed.
// The first load is everything index.html pulls in before any screen: the entry script and its preloaded chunks. Screens load later, one chunk each.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const dist = 'dist'
const KB = 1024
// Budgets in gzip bytes. Re-baselined in Explorer phase 9: the English string table (about 340 kB gzip) and the runtime and content modules grew the first load from about 312 kB to about 747 kB. The budgets sit a little above today's sizes so growth still has to be argued for.
// Next step to bring first load down: load the Stanley and tip strings lazily (about 140 kB gzip).
const FIRST_LOAD_MAX = 770 * KB
const SCREEN_MAX = 40 * KB
const PRECACHE_MAX = 4700 * KB

// A language pack is its own download, fetched only when the guest picks that language, so it is not a screen.
const LANGUAGE_PACK = /^es-/
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
