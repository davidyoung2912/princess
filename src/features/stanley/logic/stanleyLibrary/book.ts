import type { LibraryEntry } from './types'

/** Book: the calm co-pilot. Reassurance and plain words while the guest is paying. */
export const BOOK: readonly LibraryEntry[] = [
  { id: 'book.deposit', stages: ['book'], screens: ['H16', 'H17', 'H19'], link: '/book', words: 'pay upfront now amount' },
  { id: 'book.names', stages: ['book'], screens: ['H17', 'H16'], words: 'spelling passport match traveller' },
  { id: 'book.saved', stages: ['book'], screens: ['H16', 'H17', 'H18'], link: '/book', words: 'stop leave later lose draft resume' },
  { id: 'book.change', stages: ['book'], screens: ['H17', 'H18'], words: 'edit modify later rebook' },
  { id: 'book.finalPayment', stages: ['book'], screens: ['H19'], link: '/book', words: 'balance due date remaining' },
  { id: 'book.cancel', stages: ['book'], screens: ['H17', 'H19'], words: 'refund policy cancellation' },
  { id: 'book.insurance', stages: ['book'], screens: ['H16', 'H18'], words: 'protection cover medical trip' },
  { id: 'book.passport', stages: ['book'], screens: ['H17', 'H18'], words: 'document expiry valid six months' },
  { id: 'book.travellers', stages: ['book'], screens: ['P47'], link: '/plan/party', words: 'party who add person guest' },
  { id: 'book.split', stages: ['book'], screens: ['P15', 'P16'], words: 'share friends divide' },
  { id: 'book.afterConfirm', stages: ['book'], screens: ['H18', 'H20'], words: 'next steps email confirmation' },
  { id: 'book.child', stages: ['book'], screens: ['P47', 'H17'], words: 'kid baby age minor' },
  { id: 'book.payWays', stages: ['book'], screens: ['H19', 'P14'], words: 'card method currency pay' },
]
