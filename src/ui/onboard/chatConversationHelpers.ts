import type { ChatConversation } from '../../api/chatTypes'
import { stanleyAnswerInput } from '../../domain/chatBundles'
import { typingNames } from '../../domain/chatControl'
import { roomPostState } from '../../domain/chatRooms'
import { isStanleyChat } from '../../domain/stanleyThread'
import { t, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { deliveredSeen } from './chatConversationShared'
import type { SendItem } from './SendDialog'

/** The list reaching the device is itself delivery: each conversation with something unread tells its senders once. Quiet on failure; the thread says it again when opened. */
export function tellDelivered(list: readonly ChatConversation[]): void {
  for (const c of list) {
    if (c.unread <= 0 || isStanleyChat(c) || !c.last) continue
    const k = `${c.id}:${c.last.at}`
    if (deliveredSeen.has(k)) continue
    deliveredSeen.add(k)
    api.chatConversations.delivered(c.id).catch(() => deliveredSeen.delete(k))
  }
}

/** A Stanley answer as something the send dialog can pass on: plain words under "Stanley said:", with an optional note. */
export function stanleyAnswerItem(answer: string): SendItem {
  const label = t('stanley.answer.said')
  return { title: t('stanley.answer.title'), takesNote: true, input: (note) => stanleyAnswerInput(answer, label, note) ?? { kind: 'text', text: `${label} ${answer.slice(0, 1500)}` } }
}

/** The words for who is typing: one name, two names, or several people. Empty when nobody is. */
export function typingText(names: readonly string[]): string {
  const w = typingNames(names)
  return w.kind === 'one' ? t('conv.typing.one', { a: w.a }) : w.kind === 'two' ? t('conv.typing.two', { a: w.a, b: w.b }) : w.kind === 'many' ? t('conv.typing.many') : ''
}

export function roomClosedKey(state: ReturnType<typeof roomPostState>): StringKey {
  return state === 'staffOnly' ? 'room.staffOnly' : state === 'muted' ? 'room.muted' : state === 'off' ? 'room.offNow' : 'room.closedNow'
}
