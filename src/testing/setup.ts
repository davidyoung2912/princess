// Test setup only (vitest `setupFiles`); nothing in the app imports this folder. The app holds no authored reference data: it waits for the server's
// tables. Tests need the same tables, so this puts a fixed copy in use before each test file, the way the app does when the server answers.
import fixture from './reference-fixture.json'
import { replaceSailings } from '../domain/sailings'
import { replaceExcursions } from '../domain/excursions'
import { replaceVenues } from '../domain/dining'
import { replacePorts } from '../domain/ports'
import { replacePortKnowledge } from '../domain/portContent'
import { markReferenceAllReady, requireReference } from '../domain/referenceStatus'

export function seedReference(): void {
  replaceSailings({ sailings: fixture.sailings, ports: fixture.ports, template: fixture.template, homeZone: fixture.homeZone, westZone: fixture.westZone } as never)
  replaceExcursions(fixture.excursions as never)
  replaceVenues(fixture.venues as never)
  replacePorts({ guides: fixture.guides, coords: fixture.coords } as never)
  replacePortKnowledge(fixture.knowledge as never)
  requireReference(['sailings', 'catalogue', 'ports'])
  markReferenceAllReady()
}

seedReference()
