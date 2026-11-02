// Bundle budget (N1.4). Run after `npm run build`: `npm run bundle:check`. No browser needed.
// The first load is everything index.html pulls in before any screen: the entry script and its preloaded chunks. Screens load later, one chunk each.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const dist = 'dist'
const KB = 1024
// Budgets in gzip bytes. They sit a little above today's sizes (first load about 312 kB, largest screen about 7 kB) so growth has to be argued for.
const FIRST_LOAD_MAX = 350 * KB
const SCREEN_MAX = 12 * KB
const PRECACHE_MAX = 2200 * KB

const gz = (file) => gzipSync(readFileSync(file)).length
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const first = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1])
const firstSet = new Set(first)
const firstLoad = first.reduce((sum, f) => sum + gz(join(dist, f)), 0)

const assets = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'))
const screens = assets.map((f) => ({ f, size: gz(join(dist, 'assets', f)) })).filter((a) => !firstSet.has(`assets/${a.f}`))
const biggest = screens.reduce((a, b) => (b.size > a.size ? b : a), { f: '', size: 0 })
const precache = readdirSync(join(dist, 'assets')).reduce((sum, f) => sum + statSync(join(dist, 'assets', f)).size, 0)

const problems = []
if (firstLoad > FIRST_LOAD_MAX) problems.push(`first load is ${(firstLoad / KB).toFixed(1)} kB gzip, budget ${FIRST_LOAD_MAX / KB} kB (${first.join(', ')})`)
if (biggest.size > SCREEN_MAX) problems.push(`${biggest.f} is ${(biggest.size / KB).toFixed(1)} kB gzip, budget ${SCREEN_MAX / KB} kB for one screen chunk`)
if (precache > PRECACHE_MAX) problems.push(`assets total ${(precache / KB).toFixed(0)} kB, budget ${PRECACHE_MAX / KB} kB`)

console.log(`first load ${(firstLoad / KB).toFixed(1)} kB gzip of ${FIRST_LOAD_MAX / KB}; largest screen ${biggest.f} ${(biggest.size / KB).toFixed(1)} kB of ${SCREEN_MAX / KB}; assets ${(precache / KB).toFixed(0)} kB of ${PRECACHE_MAX / KB}`)
if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
