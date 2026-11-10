import type { Settings } from '../settings/settings'
import { funLevelFor } from '../settings/settings'
import type { ChatUrgency } from '../api/chatTypes'

/** A gentle sound and buzz for a message that arrives in the chat the guest has open (phase 9c). Both are off until the guest turns them on, chosen per device. */
export type FeedbackSettings = Pick<Settings, 'chatSounds' | 'chatBuzz' | 'calm' | 'fun'>

export interface FeedbackContext { muted: boolean; dnd: boolean; urgency: ChatUrgency }

/**
 * Which of the two to give. Never in calm mode or at the Quiet fun level, never in a muted chat, and never during do not disturb
 * (an urgent message still comes through, as it does for the alert itself). Neither is ever the only signal: the message is on screen and announced.
 */
export function chatFeedback(s: FeedbackSettings, c: FeedbackContext): { sound: boolean; buzz: boolean } {
  const quiet = funLevelFor(s) === 'quiet' || c.muted || (c.dnd && c.urgency !== 'urgent')
  return { sound: !quiet && s.chatSounds, buzz: !quiet && s.chatBuzz }
}
