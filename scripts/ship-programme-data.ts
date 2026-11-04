// The sample daily programme of the ships other than Sun Princess (AB4). One authored copy: `npm run shipprogrammes:gen` writes it to
// server/Princess.Api/Content/ship-programmes.json (embedded, served from GET /reference/ships/{id}/program) and `npm run catalogue:gen` seeds the same
// rows into ref.Events. Concept sample data in the same honest way as Sun's (docs/content-verification.md): Sun's programme with each ship's own rooms.
// Event ids are the same on every ship (a booking belongs to one ship); only the seeded row ids carry the ship's prefix, because ref.Events has one key.
import { EVENTS, type ShipEvent } from '../src/domain/program.ts'
import { q, shipPrefix, type CatalogueSource } from './catalogue.ts'

interface Change { place?: string; title?: string; id?: string }

interface ShipSpec { shipId: string; changes: Record<string, Change> }

/** What differs from Sun's programme. Every other event stays, in the same place (the place ids every ship's plan has). */
const SPECS: readonly ShipSpec[] = [
  {
    shipId: 'sky-princess',
    changes: {
      'welcome-show': { place: 'princess-theater' },
      trivia: { place: 'explorers-lounge' },
      cooking: { place: 'allegro' },
      bingo: { place: 'explorers-lounge' },
      'stage-show': { place: 'princess-theater' },
      'stage-early': { place: 'princess-theater' },
      jazz: { place: 'explorers-lounge' },
      'dome-show': { id: 'late-show', place: 'seawalk', title: 'Aerial show on the SeaWalk' },
      'dome-dj': { id: 'late-dj', place: 'sea-view', title: 'Dance party at the Sea View Bar' },
      movie: { place: 'movies' },
      wine: { place: 'bellinis' },
      'farewell-show': { place: 'princess-theater' },
      'port-show': { place: 'princess-theater' },
    },
  },
  {
    shipId: 'sapphire-princess',
    changes: {
      'welcome-show': { place: 'princess-theater' },
      trivia: { place: 'explorers-lounge' },
      cooking: { place: 'santa-fe' },
      bingo: { place: 'explorers-lounge' },
      'stage-show': { place: 'princess-theater' },
      'stage-early': { place: 'princess-theater' },
      jazz: { place: 'explorers-lounge' },
      'dome-show': { id: 'late-show', place: 'princess-theater', title: 'Late show: comedy and magic' },
      'dome-dj': { id: 'late-dj', place: 'sea-view', title: 'Dance party at the Sea View Bar' },
      movie: { place: 'movies' },
      wine: { place: 'sabatini' },
      'farewell-show': { place: 'princess-theater' },
      'port-show': { place: 'princess-theater' },
    },
  },
]

export interface ShipProgramme { shipId: string; events: ShipEvent[] }

function build(spec: ShipSpec): ShipProgramme {
  const events = EVENTS.map((e) => {
    const c = spec.changes[e.id] ?? {}
    return { ...e, when: [...e.when], id: c.id ?? e.id, placeId: c.place ?? e.placeId, title: c.title ?? e.title }
  })
  return { shipId: spec.shipId, events }
}

/** The programme of every ship except Sun Princess's. */
export function shipProgrammes(): ShipProgramme[] { return SPECS.map(build) }

/** The JSON the server embeds: one key per ship, one line each so a change reads as a diff. */
export function shipProgrammesFileText(): string {
  return '{\n' + shipProgrammes().map((p) => `${JSON.stringify(p.shipId)}: ${JSON.stringify(p.events)}`).join(',\n') + '\n}\n'
}

const clock = (t: string) => `${t}:00`

/** Pre-quoted SQL rows for ref.Events of the other ships (Deck is left null: those decks are authored in the server's AboardPlans, not here). */
export function shipEventRows(c: CatalogueSource): string[][] {
  const known = new Set(c.ships.map((s) => s.id))
  const rows: string[][] = []
  for (const p of shipProgrammes().filter((x) => known.has(x.shipId))) {
    const prefix = shipPrefix(p.shipId)
    for (const e of p.events) {
      rows.push([q(`${prefix}-${e.id}`), q(e.interest), q(e.title), q(e.placeId), q(clock(e.start)), String(e.minutes), q(e.age), `CAST(${q(JSON.stringify([e.interest]))} AS NVARCHAR(MAX))`,
        e.extra > 0 ? '1' : '0', 'NULL', 'NULL', String(e.extra), e.afterAllAboard ? '1' : '0', q(p.shipId)])
    }
  }
  return rows
}
