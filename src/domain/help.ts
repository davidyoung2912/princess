/** The help centre and contact options (SUP-01, SUP-02). Authored mock content; numbers are the fictional 555-01xx range. */
export interface Faq { id: string; topic: 'booking' | 'payment' | 'documents' | 'account' | 'onboard'; question: string; answer: string; link?: { to: string; label: string } }

export const FAQS: readonly Faq[] = [
  { id: 'cant-see-booking', topic: 'booking', question: 'I can’t see my booking', answer: 'Bookings made by a travel agent or on another website do not appear until you link them. Use the booking number from your confirmation, the last name of the lead guest, and the departure date. If it still does not match, check for a typing slip in the number, then call Guest Services.', link: { to: '/me/trips', label: 'Link a booking' } },
  { id: 'name-mismatch', topic: 'documents', question: 'The name on my booking does not match my passport', answer: 'A spelling fix of a few letters can be made online up to two weeks before sailing. A different name, or any change in the last two weeks, needs Guest Services, who will ask for a copy of the passport page.', link: { to: '/me/profile', label: 'Edit my details' } },
  { id: 'pay-balance', topic: 'payment', question: 'When is my final payment due, and how do I pay?', answer: 'The date is on your trip page and in Payments. Pay by card there at any time before it. Receipts are kept in Payments afterwards.', link: { to: '/me/payments', label: 'Payments' } },
  { id: 'update-card', topic: 'payment', question: 'How do I change the card I pay with?', answer: 'Add the new card in Payments. We keep only the last four digits and the expiry date, and you can remove a card at any time.', link: { to: '/me/payments', label: 'Payments' } },
  { id: 'what-documents', topic: 'documents', question: 'What documents do I need for this cruise?', answer: 'This is a round trip from Fort Lauderdale. US citizens need proof of citizenship (a passport, or a certified birth certificate) and, if 16 or older, a photo ID. A passport is strongly recommended in case you must fly home from a port. Other citizens need a passport. Passports should be valid for six months after the return date.', link: { to: '/me/documents', label: 'Documents wallet' } },
  { id: 'lost-documents', topic: 'documents', question: 'I have lost my passport or a travel document', answer: 'Call Guest Services now. If you have not yet sailed they can tell you what replacement is accepted and whether you must move to a later sailing. Do not wait until embarkation day.' },
  { id: 'helper', topic: 'account', question: 'Can a family member manage my booking for me?', answer: 'Yes, if you agree. Add them as a helper and choose what they may do: view, manage documents, pay, or edit details. You can remove them at any time, and everything they change appears in your history.', link: { to: '/me/helper', label: 'Family helper' } },
  { id: 'notifications', topic: 'account', question: 'How do I stop notifications?', answer: 'Choose what you hear about and how in Notifications. Critical notices about itinerary changes, port closures and safety cannot be turned off, because you may need to act on them.', link: { to: '/me/notifications', label: 'Notifications' } },
  { id: 'text-size', topic: 'account', question: 'How do I make the text bigger?', answer: 'Settings has text size, a high-contrast theme and reduced motion. They apply on every screen.', link: { to: '/me/settings', label: 'Settings' } },
  { id: 'accessibility', topic: 'onboard', question: 'I need accessible transport, a wheelchair or help at the port', answer: 'Add your needs to your profile now, and tell Guest Services at least 14 days before sailing so equipment and assistance can be arranged. Tender ports such as Belize City need extra notice.', link: { to: '/me/profile', label: 'Edit my details' } },
  { id: 'cancel', topic: 'booking', question: 'I need to cancel or change my sailing', answer: 'Changes and cancellations are handled by Guest Services so that fees and refunds are explained to you in person. Have your booking number ready.' },
  { id: 'children', topic: 'account', question: 'How do my children’s accounts work?', answer: 'Children sail on the booker’s booking. Their accounts are supervised: the booker manages their details, documents and payments.' },
]

const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? []

/** FAQs matching a search, best first: every word must appear, and a match in the question counts more than one in the answer. */
export function searchFaqs(query: string, list: readonly Faq[] = FAQS): Faq[] {
  const terms = words(query)
  if (terms.length === 0) return [...list]
  return list
    .map((f) => {
      const q = f.question.toLowerCase()
      const a = f.answer.toLowerCase()
      const hit = terms.every((w) => q.includes(w) || a.includes(w))
      return { f, score: hit ? terms.reduce((n, w) => n + (q.includes(w) ? 3 : 1), 0) : 0 }
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .map((x) => x.f)
}

export type ContactId = 'chat' | 'phone' | 'callback' | 'email'
export interface ContactOption { id: ContactId; /** Opening hours in US Eastern time as [from, to) hours; null is always open. */ hours: readonly [number, number] | null }

export const CONTACT_OPTIONS: readonly ContactOption[] = [
  { id: 'chat', hours: null },
  { id: 'phone', hours: [8, 22] },
  { id: 'callback', hours: [8, 22] },
  { id: 'email', hours: null },
]

export const SUPPORT_EMAIL = 'help@example.com'

/** Open or closed at an Eastern-time hour (0–23.99), and the usual wait in minutes (busier mid-morning and early evening). */
export function contactStatus(option: ContactOption, easternHour: number): { open: boolean; waitMinutes: number | null } {
  const open = !option.hours || (easternHour >= option.hours[0] && easternHour < option.hours[1])
  if (!open || option.id === 'email') return { open, waitMinutes: null }
  const busy = (easternHour >= 9 && easternHour < 11) || (easternHour >= 17 && easternHour < 19)
  return { open, waitMinutes: option.id === 'chat' ? (busy ? 6 : 2) : option.id === 'phone' ? (busy ? 12 : 4) : 0 }
}

export type TicketStatus = 'received' | 'inProgress' | 'resolved'

export const TICKET_RECEIVED_MS = 10 * 60_000
export const TICKET_IN_PROGRESS_MS = 60 * 60_000

/** How far along a callback or email request is, from its age (the crew side is simulated). */
export function ticketStatus(createdAt: number, now: number): TicketStatus {
  const age = now - createdAt
  return age < TICKET_RECEIVED_MS ? 'received' : age < TICKET_IN_PROGRESS_MS ? 'inProgress' : 'resolved'
}
