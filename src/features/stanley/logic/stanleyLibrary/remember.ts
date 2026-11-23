import type { LibraryEntry } from './types'

/** Remember: the storyteller. Short answers for after the trip. */
export const REMEMBER: readonly LibraryEntry[] = [
  { id: 'remember.book', stages: ['remember'], screens: ['M17', 'M16'], link: '/me/memories', words: 'memory book album scrapbook make create' },
  { id: 'remember.write', stages: ['remember'], screens: ['M17'], link: '/me/memories', words: 'diary journal notes draft write day' },
  { id: 'remember.photos', stages: ['remember'], screens: ['M17'], link: '/me/memories', words: 'pictures add picture gallery cover page' },
  { id: 'remember.print', stages: ['remember'], screens: ['M17'], link: '/me/memories', words: 'share copy save send paper pdf' },
  { id: 'remember.private', stages: ['remember'], screens: ['M17', 'M18'], link: '/me/memories', words: 'privacy see notes share family visible' },
  { id: 'remember.recap', stages: ['remember'], screens: ['M16', 'M15'], link: '/me/recap', words: 'summary numbers ports miles trip overview' },
  { id: 'remember.wrapped', stages: ['remember'], screens: ['M18', 'M16'], link: '/me/wrapped', words: 'cards highlights package worth value' },
  { id: 'remember.feedback', stages: ['remember'], screens: ['M19', 'M16'], link: '/me/feedback', words: 'rate review survey comment tell complaint' },
  { id: 'remember.rebook', stages: ['remember'], screens: ['M22', 'M17'], link: '/me/rebook', words: 'again next trip sail future offer discount' },
  { id: 'remember.history', stages: ['remember'], screens: ['M15'], link: '/me/history', words: 'past previous trips sailed record' },
]
