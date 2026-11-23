import type { LibraryEntry } from './types'

/** Disembark: the packer. Short answers for the last evening and morning. */
export const DISEMBARK: readonly LibraryEntry[] = [
  { id: 'disembark.bagsOut', stages: ['disembark'], screens: ['H40', 'H39'], link: '/home/disembark/bags', words: 'luggage suitcase tag night deadline' },
  { id: 'disembark.whenOff', stages: ['disembark'], screens: ['H39'], link: '/home/disembark', words: 'walk off group colour exit leave' },
  { id: 'disembark.breakfast', stages: ['disembark'], screens: ['H39', 'H41'], link: '/home/disembark/final-night', words: 'eat morning food hungry' },
  { id: 'disembark.customs', stages: ['disembark'], screens: ['H43'], link: '/home/disembark/customs', words: 'declare duty allowance forms border goods' },
  { id: 'disembark.forgot', stages: ['disembark'], screens: ['H42', 'S34'], link: '/home/disembark/sweep', words: 'left behind lost item safe charger' },
  { id: 'disembark.tips', stages: ['disembark'], screens: ['H41', 'M10'], link: '/me/bill', words: 'tip service charge crew remove adjust' },
  { id: 'disembark.onward', stages: ['disembark'], screens: ['H44', 'H45'], link: '/home/disembark/onward', words: 'flight transport shuttle taxi rideshare' },
  { id: 'disembark.earlyFlight', stages: ['disembark'], screens: ['H39'], link: '/home/disembark', words: 'airport plane morning leave sooner' },
  { id: 'disembark.bill', stages: ['disembark'], screens: ['M10', 'M13'], link: '/me/bill', words: 'charges receipt folio total dispute' },
  { id: 'disembark.goodbye', stages: ['disembark'], screens: ['H39'], link: '/home/disembark', words: 'card key medallion return scan' },
]
