import { describe, expect, it } from 'vitest'
import { SCREEN_LIST } from '../../../../app/routes/screens'
import { DESTINATIONS, QUALIFIED } from './destinations'
import { entityIndex } from './entities'
import { NOT_ASKED } from './screenSpec'
import { TOPICS } from './topics'

/** Phase 5 gate: every screen of the app can be reached by asking, through a topic's pill or a named thing, unless it is listed as not something a guest asks for. */
describe('coverage', () => {
  it('offers every destination from some topic', () => {
    const offered = new Set(TOPICS.flatMap((t) => t.pills.map((p) => p.dest)))
    expect(Object.keys(DESTINATIONS).filter((d) => !offered.has(d) && !QUALIFIED.has(d) && d !== 'search')).toEqual([])
  })

  it('reaches every screen with a fixed path', () => {
    const paths = new Set(Object.values(DESTINATIONS).map((d) => d.path.split('?')[0]))
    for (const e of entityIndex().entities) paths.add(e.path)
    const missing = SCREEN_LIST.filter((s) => !s.path.includes(':') && !paths.has(s.path) && !NOT_ASKED[s.id]).map((s) => `${s.id} ${s.path}`)
    expect(missing).toEqual([])
  })

  it('says why a screen is left out, and only leaves out screens that exist', () => {
    for (const [id, why] of Object.entries(NOT_ASKED)) { expect(SCREEN_LIST.some((s) => s.id === id), id).toBe(true); expect(why.length, id).toBeGreaterThan(10) }
  })
})
