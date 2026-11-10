import type { LibraryEntry } from './types'

/** Sea: the cruise director. Short answers for days at sea. */
export const SEA: readonly LibraryEntry[] = [
  { id: 'sea.today', stages: ['sea'], screens: ['P34', 'H22'], link: '/plan/day', words: 'schedule events plan activities' },
  { id: 'sea.threeHours', stages: ['sea'], screens: ['P34'], link: '/plan/day', words: 'free time spare nothing to do ideas' },
  { id: 'sea.quietPool', stages: ['sea'], screens: ['S13', 'S01'], link: '/ship/map', words: 'swim deck sun lounger crowd busy' },
  { id: 'sea.tonight', stages: ['sea'], screens: ['H22', 'P34'], link: '/home/briefing', words: 'evening show entertainment tonight' },
  { id: 'sea.dressCode', stages: ['sea'], screens: ['P34', 'S02'], link: '/plan/day', words: 'formal dress code clothes outfit' },
  { id: 'sea.dinnerSea', stages: ['sea'], screens: ['S02', 'P38'], link: '/plan/dining', words: 'table reservation move change' },
  { id: 'sea.order', stages: ['sea'], screens: ['S15'], link: '/ship/venues', words: 'room service cabin delivery menu' },
  { id: 'sea.clocks', stages: ['sea'], screens: ['H22'], link: '/home/briefing', words: 'time zone hour clock change forward back' },
  { id: 'sea.bill', stages: ['sea'], screens: ['M10'], link: '/me/bill', words: 'folio charges account total spending' },
  { id: 'sea.rough', stages: ['sea'], screens: ['S01'], link: '/ship/seasick', words: 'seasick nausea motion waves storm' },
]
