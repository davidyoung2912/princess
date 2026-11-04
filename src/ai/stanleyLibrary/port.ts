import type { LibraryEntry } from './types'

/** Port: the local friend. Short answers for a day ashore. */
export const PORT: readonly LibraryEntry[] = [
  { id: 'port.allAboard', stages: ['port'], screens: ['S37'], link: '/ship/port', words: 'return back gangway deadline late time' },
  { id: 'port.tender', stages: ['port'], screens: ['S37', 'H09'], link: '/ship/port', words: 'boat anchor shuttle queue' },
  { id: 'port.missed', stages: ['port'], screens: ['S37', 'S32'], link: '/ship/safe-ashore', words: 'late left behind gone stuck' },
  { id: 'port.money', stages: ['port'], screens: ['S38'], link: '/ship/port/guide', words: 'currency cash exchange dollars card pay' },
  { id: 'port.taxi', stages: ['port'], screens: ['S32', 'S38'], link: '/ship/safe-ashore', words: 'cab ride driver fare transport' },
  { id: 'port.shipTour', stages: ['port'], screens: ['P37'], link: '/plan/excursions', words: 'tour booked wait guarantee independent' },
  { id: 'port.heat', stages: ['port'], screens: ['S37', 'S39'], link: '/ship/port/snapshot', words: 'sun weather temperature rain umbrella' },
  { id: 'port.say', stages: ['port'], screens: ['S38'], link: '/ship/port/guide', words: 'language words phrase speak hello' },
  { id: 'port.children', stages: ['port'], screens: ['S32'], link: '/ship/safe-ashore', words: 'kids family safe walking' },
  { id: 'port.walkBack', stages: ['port'], screens: ['S37'], link: '/ship/port', words: 'leave by time distance walking minutes' },
]
