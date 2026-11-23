import type { LibraryEntry } from './types'

/** Discover: the honest advisor. What the words and numbers on a sailing, a cabin and a cost page mean. */
export const DISCOVER: readonly LibraryEntry[] = [
  { id: 'discover.tender', stages: ['discover'], screens: ['H09', 'H08'], link: '/home/cruise', words: 'boats anchor ashore port' },
  { id: 'discover.allAboard', stages: ['discover'], screens: ['H08', 'H09'], words: 'back on board deadline leave sail' },
  { id: 'discover.taxes', stages: ['discover'], screens: ['H12'], link: '/home/cruise/cost', words: 'fees port charges government' },
  { id: 'discover.gratuities', stages: ['discover'], screens: ['H12'], link: '/home/cruise/cost', words: 'tips service charge crew' },
  { id: 'discover.extras', stages: ['discover'], screens: ['H12'], link: '/home/cruise/cost', words: 'drinks specialty internet excursions packages' },
  { id: 'discover.guarantee', stages: ['discover'], screens: ['H14'], link: '/home/cabins', words: 'guaranteed assigned category cheaper' },
  { id: 'discover.quiet', stages: ['discover'], screens: ['H14'], link: '/home/cabins', words: 'noise noisy loud sleep light' },
  { id: 'discover.balcony', stages: ['discover'], screens: ['H14'], link: '/home/cabins', words: 'veranda worth view' },
  { id: 'discover.deck', stages: ['discover'], screens: ['H14', 'H10'], link: '/home/ship', words: 'floor level high low' },
  { id: 'discover.offers', stages: ['discover'], screens: ['H15'], link: '/home/offers', words: 'deals discount promotion onboard credit' },
  { id: 'discover.compare', stages: ['discover'], screens: ['H11', 'H51', 'H48'], link: '/home/saved/compare', words: 'versus difference two' },
  { id: 'discover.estimate', stages: ['discover'], screens: ['H12', 'H08'], link: '/home/cruise/cost', words: 'price approximate final accurate' },
  { id: 'discover.documents', stages: ['discover'], screens: ['H08', 'H09'], words: 'passport visa papers entry citizen' },
  { id: 'discover.dining', stages: ['discover'], screens: ['H10'], link: '/home/ship', words: 'restaurants food eat dinner buffet' },
]
