import type { HeadId, PoseId } from '../art/manifest'

/** The picture that sits at the end of a screen's header bar: a pose or a head, chosen by what the screen is for. Decorative only (the title says it all in words). The Explorers, Today's Plan and Home draw their own art in their first card, so they are not listed. */
export interface PageArt { pose?: PoseId; head?: HeadId }

const ART: Record<string, PageArt> = {
  '/me/documents': { pose: 'passport' },
  '/me/bill': { head: 'accountant' }, '/me/bill/final': { head: 'accountant' },
  '/me/help': { head: 'customer-service' }, '/ship/help-now': { head: 'customer-service' }, '/ship/text-help': { head: 'customer-service' },
  '/me/status': { head: 'maintenance' },
  '/me/memories': { head: 'vacation' },
  '/me/assist': { head: 'gentle' }, '/plan/assistance': { head: 'gentle' }, '/plan/access': { head: 'gentle' }, '/ship/access': { head: 'gentle' },
  '/deck-plans': { head: 'navigating' },
  '/ship/search': { head: 'sherlock' }, '/ship/lost-found': { head: 'sherlock' },
  '/ship/info': { head: 'captain' }, '/nautical': { head: 'captain' },
  '/ship/kids-report': { head: 'lifeguard' },
  '/ship/teen': { pose: 'pirate' },
  '/plan/checklist': { pose: 'checklist' },
  '/plan/packing': { head: 'formal' }, '/plan/ship-packing': { pose: 'suitcase' },
  '/plan/dining': { head: 'chef' },
  '/plan/day': { pose: 'planning' },
  '/plan/party': { pose: 'dancing' },
  '/plan/weather': { pose: 'umbrella' },
  '/itinerary': { pose: 'checking-itinerary' },
  '/ship/muster': { pose: 'lifejacket' },
  '/ship/port': { pose: 'port-visit' }, '/ship/port/guide': { pose: 'port-visit' }, '/home/ports/:id': { pose: 'port-visit' },
  '/ship/drinks': { pose: 'bar' }, '/ship/spa': { pose: 'spa' }, '/ship/shops': { pose: 'shopping' }, '/ship/photos': { pose: 'camera' },
}

export const pageArt = (path: string | undefined): PageArt | undefined => (path ? ART[path] : undefined)
