import type { LibraryEntry } from './types'

/** Prebook: the planner. What to book, pack and decide before sailing. */
export const PREBOOK: readonly LibraryEntry[] = [
  { id: 'prebook.excursionsEarly', stages: ['prebook'], screens: ['P37'], link: '/plan/excursions', words: 'book ahead advance tours ashore' },
  { id: 'prebook.shipOrOwn', stages: ['prebook'], screens: ['P37'], link: '/plan/excursions', words: 'independent ship tour guided ashore' },
  { id: 'prebook.anytimeDining', stages: ['prebook'], screens: ['P38'], link: '/plan/dining', words: 'dinner restaurant time table fixed' },
  { id: 'prebook.specialty', stages: ['prebook'], screens: ['P38'], link: '/plan/dining', words: 'restaurant extra charge cover special dinner' },
  { id: 'prebook.evening', stages: ['prebook'], screens: ['P02', 'P03'], link: '/plan/packing', words: 'dress code formal clothes wear' },
  { id: 'prebook.notAllowed', stages: ['prebook'], screens: ['P02', 'P03'], link: '/plan/packing', words: 'banned forbidden prohibited bring pack iron kettle' },
  { id: 'prebook.phone', stages: ['prebook'], screens: ['P05'], link: '/plan/phone', words: 'roaming data wifi signal charges' },
  { id: 'prebook.prepay', stages: ['prebook'], screens: ['P23', 'P24'], link: '/plan/prepay', words: 'drinks package wifi extras cheaper discount' },
  { id: 'prebook.checklistFirst', stages: ['prebook'], screens: ['P01'], link: '/plan/checklist', words: 'start begin tasks todo priority' },
  { id: 'prebook.weather', stages: ['prebook'], screens: ['P31', 'P02'], link: '/plan/weather', words: 'forecast rain hot cold climate' },
  { id: 'prebook.health', stages: ['prebook'], screens: ['P07', 'P08'], link: '/plan/health-prep', words: 'vaccine vaccination doctor insurance medical' },
  { id: 'prebook.gift', stages: ['prebook'], screens: ['P28'], link: '/plan/gifts', words: 'send surprise present cabin' },
  { id: 'prebook.dayPlan', stages: ['prebook'], screens: ['P34', 'P39', 'P40'], link: '/plan/day', words: 'itinerary schedule suggest autopilot' },
]
