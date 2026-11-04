import type { LibraryEntry } from './types'

/** Embark: the tour guide. Short answers for the first hours aboard. */
export const EMBARK: readonly LibraryEntry[] = [
  { id: 'embark.muster', stages: ['embark'], screens: ['S25'], link: '/ship/muster', words: 'safety drill muster life jacket required' },
  { id: 'embark.cabinReady', stages: ['embark'], screens: ['H32', 'H33'], link: '/home/embarkation/steps', words: 'room key ready steward bags' },
  { id: 'embark.lunch', stages: ['embark'], screens: ['S02', 'S03'], link: '/ship/venues', words: 'hungry food eat buffet lunch open' },
  { id: 'embark.findWay', stages: ['embark'], screens: ['S01'], link: '/ship/map', words: 'map lost deck stairs lift find' },
  { id: 'embark.bagsLate', stages: ['embark'], screens: ['H33', 'H34'], link: '/home/embarkation/steps', words: 'luggage suitcase missing delivered late' },
  { id: 'embark.meetFamily', stages: ['embark'], screens: ['H35', 'H32'], link: '/home/meeting-point', words: 'group lost meet family rendezvous' },
  { id: 'embark.sailAway', stages: ['embark'], screens: ['H34', 'H32'], link: '/plan/day', words: 'leave depart sail away time deck' },
  { id: 'embark.firstDinner', stages: ['embark'], screens: ['S02', 'H34'], link: '/plan/dining', words: 'table reserve seating booking tonight' },
  { id: 'embark.wifiFirst', stages: ['embark'], screens: ['H34', 'H32'], words: 'signal internet wifi roaming data charges' },
  { id: 'embark.quiet', stages: ['embark'], screens: ['S01', 'S13'], link: '/ship/map', words: 'crowd noisy calm busy relax' },
]
