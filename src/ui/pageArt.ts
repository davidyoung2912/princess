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
  '/dining-today': { head: 'chef' },
  '/plan/day': { pose: 'planning' },
  '/plan/party': { pose: 'dancing' },
  '/plan/weather': { pose: 'umbrella' },
  '/itinerary': { pose: 'checking-itinerary' },
  '/ship/muster': { pose: 'lifejacket' },
  '/ship/port': { pose: 'port-visit' }, '/ship/port/guide': { pose: 'port-visit' }, '/home/ports/:id': { pose: 'port-visit' },
  '/ship/drinks': { pose: 'bar' }, '/ship/spa': { pose: 'spa' }, '/ship/shops': { pose: 'shopping' }, '/ship/photos': { pose: 'camera' },
}

/** Art for a whole area of the app: the longest listed prefix of a screen's path wins, and a screen listed in `ART` above keeps its own. The explorers and Today's Plan draw their own art, so they are not listed. */
const AREAS: Array<[string[], PageArt]> = [
  [['/home/check-in', '/home/boarding-pass', '/home/find-pass', '/plan/travel', '/plan/getting-there', '/home/disembark/customs', '/home/clearance'], { pose: 'passport' }],
  [['/home/embarkation', '/home/luggage', '/home/disembark'], { pose: 'suitcase' }],
  [['/home/disembark/final-night', '/me/farewell', '/me/follow-up', '/me/rebook'], { head: 'congratulations' }],
  [['/home/cruise', '/home/sailings', '/home/explore', '/home/ships', '/home/ship'], { pose: 'binoculars' }],
  [['/home/ports', '/home/countries', '/ship/port/snapshot', '/ship/safe-ashore'], { pose: 'port-visit' }],
  [['/home/decide', '/home/saved', '/home/quiz', '/home/cabins', '/plan/compare', '/plan/cabins'], { head: 'idea' }],
  [['/home/ask', '/home/concierge', '/home/advisors', '/home/mode', '/ship/ask-ship', '/chat'], { head: 'chatting' }],
  [['/home/cruise/cost', '/home/offers', '/plan/money-plan', '/plan/split', '/plan/shares', '/plan/price-watch', '/plan/fare-check', '/plan/prepay', '/plan/gifts', '/plan/upgrades', '/plan/cart', '/me/money', '/me/ledger', '/me/payments', '/me/packages', '/me/loyalty'], { head: 'accounting' }],
  [['/book', '/plan/hold', '/plan/guarantee', '/plan/contract', '/plan/reservations'], { head: 'scheduler' }],
  [['/plan/ahead', '/plan/starter', '/plan/organiser', '/plan/rhythm', '/plan/taste', '/plan/surprises', '/plan/traditions', '/plan/autopilot', '/plan/what-if', '/plan/readiness', '/plan/paste', '/plan/group-poll', '/plan/share-links', '/plan/clubs', '/plan/difficulty'], { head: 'planning' }],
  [['/home/updates', '/home/briefing', '/home/summary', '/home/disruption', '/home/delayed', '/plan/storm', '/me/alerts', '/me/notifications'], { head: 'surprised' }],
  [['/plan/medical', '/plan/health-prep', '/plan/allergy', '/ship/health', '/ship/seasick', '/ship/allergy-chain', '/ship/dining-prefs'], { head: 'lifeguard' }],
  [['/ship/emergency', '/ship/report', '/me/report-problem', '/me/fix-it', '/me/cases'], { head: 'security' }],
  [['/me/calm'], { pose: 'sleep' }],
  [['/me/gentle', '/me/anxiety', '/ship/dnd', '/ship/ok-tap', '/ship/solo'], { head: 'gentle' }],
  [['/plan/family-link', '/plan/child-story', '/plan/child-brief', '/ship/family', '/chat/children'], { pose: 'pirate' }],
  [['/ship/map', '/ship/where', '/ship/steps', '/ship/loungers'], { head: 'navigating' }],
  [['/ship/sea', '/ship/along', '/ship/sky', '/ship/sightings', '/ship/pulse', '/weather'], { head: 'weather' }],
  [['/ship/room', '/ship/laundry', '/ship/requests', '/ship/order'], { head: 'customer-service' }],
  [['/ship/wifi', '/ship/tv', '/plan/phone', '/me/settings', '/me/privacy', '/me/print', '/me/marketing'], { head: 'maintenance' }],
  [['/ship/games'], { head: 'gaming' }],
  [['/ship/community'], { pose: 'theatre' }],
  [['/me/diary', '/me/recap', '/me/wrapped', '/me/history', '/me/trips', '/ship/read-aloud', '/ship/you-said'], { pose: 'camera' }],
  [['/me/profile', '/me/helper', '/me/stanley-can', '/me/stanley-activity', '/me/reminders', '/me/demo', '/me/contact', '/account'], { head: 'stanley' }],
  [['/me/feedback', '/me/sustainability'], { head: 'proud' }],
]

const AREA_ART = new Map<string, PageArt>(AREAS.flatMap(([paths, art]) => paths.map((p) => [p, art] as [string, PageArt])))

/** The art for a screen's route path: its own entry, else the nearest enclosing area. */
export function pageArt(path: string | undefined): PageArt | undefined {
  if (!path) return undefined
  if (ART[path]) return ART[path]
  for (let p = path; p; p = p.slice(0, p.lastIndexOf('/'))) {
    const hit = AREA_ART.get(p)
    if (hit) return hit
  }
  return undefined
}
