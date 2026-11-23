import { shareInput } from '../../domain/chatBundles'
import { ShareButton } from './ShareButton'

/**
 * "Send to chat" on a venue, a menu, a booked excursion or dinner, or an event (a plan). It opens the shared send dialog, where one or more chats can be chosen. The screen names only the thing's `ref`
 * (`venue:<id>`, `menu:<id>:<meal>`, `excursion:<id>`, `dining:<id>`, or `<eventId>:<day>` for a plan), and the server builds the words from its own data, so nothing about price or booking numbers can go with it.
 * A venue or menu goes as a bundle; the older kinds keep their own cards.
 */
export function SendToChat({ shareRef, title, kind = 'card' }: { shareRef: string; title: string; kind?: 'card' | 'plan' }) {
  const takesNote = kind === 'plan' || shareInput(shareRef, kind).kind === 'bundle'
  return <ShareButton item={{ title, shareRef, takesNote, input: (note) => shareInput(shareRef, kind, note) }} />
}
