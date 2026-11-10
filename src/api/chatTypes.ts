/** Chat connections (docs/chat-plan.md, phase 2). People are the public id of their user; another guest is only ever a first name and a last initial. */

/** How a found person relates to the caller. `asked`: the caller already asked. `waiting`: they asked the caller. `approval`: waiting for a guardian. */
export type ChatRelation = 'none' | 'asked' | 'waiting' | 'approval' | 'connected'

export interface ChatPerson { id: string; name: string; relation: ChatRelation }

export type ChatConnectionKind = 'connected' | 'incoming' | 'outgoing' | 'declined' | 'approval'

export interface ChatConnection {
  id: string
  kind: ChatConnectionKind
  personId: string
  name: string
  /** The direct conversation once connected. */
  conversationId: string | null
  /** For an approval: which child, and who they asked. */
  childId: string | null
  childName: string | null
  /** Agreed, and the sender has not yet seen that. */
  isNew: boolean
  at: number
  expiresAt: number
}

export interface ChatConnections {
  connected: ChatConnection[]
  incoming: ChatConnection[]
  outgoing: ChatConnection[]
  answers: ChatConnection[]
  approvals: ChatConnection[]
}

/** How much a message matters (docs/chat-urgency-plan.md). Only `urgent` breaks through do not disturb; only staff and a guardian of a child in the chat may send it. */
export type ChatUrgency = 'normal' | 'important' | 'urgent'

/** `urgentUnacked` counts urgent messages from others that this guest has not acknowledged; `urgentConversations` are the conversations they are in (the same on every device). */
export interface ChatSummary {
  incoming: number; approvals: number; answers: number; newlyConnected: number; unread: number
  urgentUnacked: number; urgentConversations: string[]
}

/** One-tap do not disturb: when it ends (milliseconds), or 0 when it is off. It ends by itself and follows the guest across devices. */
export interface ChatDnd { until: number }
export type ChatDndMode = 'hour' | 'morning' | 'off'

export interface ChatSettings { findable: boolean; showPreview: boolean }

/** Why chat by text cannot be turned on: a child's account, no number on the profile, a number not yet confirmed, or switched off for everyone. */
export type ChatSmsReason = 'supervised' | 'noPhone' | 'unverified' | 'off'

/** Chat by text for a guest ashore. `on` is the choice; `idle` also counts 30 minutes with the app closed as ashore; `available` is whether it can be turned on. */
export interface ChatSms { on: boolean; idle: boolean; available: boolean; reason: ChatSmsReason | null }

export interface ChatConnectionsApi {
  /** Rejects `invalid` (`query`) for a name under 3 letters. */
  search(query: string): Promise<ChatPerson[]>
  list(): Promise<ChatConnections>
  summary(): Promise<ChatSummary>
  /** Rejects `notFound`, `invalid` (`self`, `noGuardian`) or `conflict` (`connected`, `alreadyAsked`, `cooldown`, `tooManyOpen`, `tooMany`). */
  request(toUserId: string): Promise<ChatConnection>
  /** Rejects `notFound` or `conflict` (answered, expired). */
  respond(id: string, accept: boolean, block?: boolean): Promise<ChatConnection>
  cancel(id: string): Promise<void>
  end(id: string): Promise<void>
  /** The sender has seen the answers. */
  seen(): Promise<void>
  /** Do not disturb: holds phone alerts and the in-app pop-up, but never an urgent message. */
  dnd(): Promise<ChatDnd>
  /** Rejects `forbidden` (`supervised`). */
  setDnd(mode: ChatDndMode): Promise<ChatDnd>
  settings(): Promise<ChatSettings>
  saveSettings(settings: ChatSettings): Promise<ChatSettings>
  sms(): Promise<ChatSms>
  /** Rejects `invalid` (`noPhone`, `unverified`, `off`) or `forbidden` (`supervised`) when it cannot be turned on. */
  saveSms(on: boolean, idle: boolean): Promise<ChatSms>
  /** Hide me: not findable, every chat ended, every waiting request withdrawn. Returns the new settings. */
  hide(): Promise<ChatSettings>
}

// ---- Conversations and messages (docs/chat-plan.md, phase 4) ----

export type ConversationKind = 'party' | 'direct' | 'group'

/** The last line of a conversation, for the list. `fromName` is empty for your own message. */
export interface ChatLast { text: string; photo: boolean; mine: boolean; fromName: string; at: number; /** Of the last message; absent when normal. */ urgency?: ChatUrgency }

export interface ChatConversation {
  id: string
  kind: ConversationKind
  /** The other person for a direct chat, "My group" for the booking's chat. */
  name: string
  /** First name and last initial of everyone else in it. */
  members: string[]
  last: ChatLast | null
  /** The same on every device; clears when the conversation is read. */
  unread: number
  muted: boolean
  /** Sending has stopped: the chat ended, or you left. It stays readable. */
  closed: boolean
  at: number
  /** A supervised child is in it, so their parent or guardian can read it. Every member is told. */
  guardianCanRead?: boolean
}

export interface ChatMessage {
  id: string
  from: string
  /** First name and last initial of someone else; absent for your own message. */
  fromName?: string
  text: string
  at: number
  photo?: string
  /** People who have read it, when both they and the sender have read receipts on. */
  seenBy?: string[]
  /** A line about the group ("Sam R. left the group"), not something a person said. */
  system?: boolean
  /** It came in by text from someone ashore. */
  viaSms?: boolean
  /** Absent when normal. */
  urgency?: ChatUrgency
  /** Urgent, yours: the public ids of members who have acknowledged it. */
  ackedBy?: string[]
  /** Urgent, from someone else: whether you have acknowledged it. */
  acked?: boolean
}

/** `ashore`: people in it who are ashore and answer by text, so a reply is not expected at once. */
/** `mayUrgent`: you may send an urgent message here (staff, or a guardian of a child in it). */
export interface ChatThread { conversation: ChatConversation; messages: ChatMessage[]; hasMore: boolean; ashore?: string[]; mayUrgent?: boolean }

export interface ChatPhotoInput { type: string; bytes: number; dataUrl: string; caption: string }

export interface ChatConversationsApi {
  list(): Promise<ChatConversation[]>
  /** The latest 30 messages, or the page before the message `before`. Rejects `notFound` for a conversation you are not in. */
  thread(id: string, before?: string): Promise<ChatThread>
  /**
   * `clientId` makes a retry safe: a repeat returns the stored message. Rejects `invalid` (`blocked`: the word filter, nothing was sent; `text`; `contactInfo`),
   * `conflict` (`closed`) or `notFound`. `urgency` is normal when left out; urgent rejects `forbidden` (`urgency`) unless you may send it, and an unknown level rejects `invalid` (`urgency`).
   */
  send(id: string, text: string, clientId: string, urgency?: ChatUrgency): Promise<ChatMessage>
  /** Rejects `invalid` (`type`, `size`, `empty`, `contactInfo`, `blocked`), `forbidden` (`age`), `conflict` (`closed`) or `notFound`. */
  sendPhoto(id: string, input: ChatPhotoInput): Promise<ChatMessage>
  /** "Got it" on an urgent message from someone else; repeating it changes nothing. Rejects `invalid` (`notUrgent`) or `notFound`. */
  ack(id: string, messageId: string): Promise<void>
  /** Marks everything read, on every device. */
  read(id: string): Promise<void>
  /** Returns the new state. */
  mute(id: string, on: boolean): Promise<boolean>
}

// ---- Groups (docs/chat-plan.md, phase 5) ----

export interface ChatGroupMember { id: string; name: string; you: boolean; creator: boolean }

/** An invitation the creator is still waiting on. `needsGuardian`: the person is a child and their guardian must say yes. */
export interface ChatGroupWaiting { inviteId: string; personId: string; name: string; needsGuardian: boolean }

/** A group as a member sees it. `id` is the conversation id. `waiting` is filled only for the creator. `max` is the size limit, the creator included. */
export interface ChatGroup { id: string; name: string; members: ChatGroupMember[]; waiting: ChatGroupWaiting[]; isCreator: boolean; max: number }

/** `incoming` is for the guest; `approval` is for a child the guest is guardian of (`childId`, `childName`). `from` is the inviter's short name. */
export interface ChatGroupInvite {
  id: string
  kind: 'incoming' | 'approval'
  groupName: string
  from: string
  childId: string | null
  childName: string | null
  at: number
  expiresAt: number
}

export interface ChatGroupsApi {
  /**
   * Makes a group from 2 to 24 connected people and invites each. Rejects `invalid` (`name`, `blocked`, `tooFew`, `tooMany`, `notConnected`, `noGuardian`)
   * or `forbidden` (`supervised`: a child cannot make a group).
   */
  create(name: string, personIds: string[]): Promise<ChatGroup>
  /** Rejects `notFound` unless you are an active member. */
  get(id: string): Promise<ChatGroup>
  /** Creator only. Rejects `invalid` (`name`, `blocked`) or `forbidden` (`creator`). */
  rename(id: string, name: string): Promise<ChatGroup>
  /** Creator only. Rejects `invalid` (`person`, `notConnected`, `noGuardian`), `forbidden` (`creator`) or `conflict` (`full`). */
  invite(id: string, personIds: string[]): Promise<ChatGroup>
  /** Creator only; never themself. */
  remove(id: string, personId: string): Promise<void>
  leave(id: string): Promise<void>
  invites(): Promise<ChatGroupInvite[]>
  /** A decline is quiet. Rejects `conflict` (`answered`, `expired`, `full`) or `notFound`. */
  respond(id: string, accept: boolean): Promise<void>
}

// ---- Guardians (docs/chat-plan.md, phase 7) ----

/** A child you supervise: their id and first name. */
export interface ChatChild { id: string; name: string }

/** A guardian's read-only view of a supervised child's chats. Every read is recorded. */
export interface ChatGuardianApi {
  /** Empty for anyone who supervises no one. */
  children(): Promise<ChatChild[]>
  /** The child's conversations as the child sees them. Every read is recorded. Rejects `notFound` when the child is not yours to read. */
  conversations(childId: string): Promise<ChatConversation[]>
  /** One page of the child's conversation as the child sees it; nothing is marked read and nothing can be sent. Rejects `notFound` when it is not yours to read. */
  thread(childId: string, conversationId: string, before?: string): Promise<ChatThread>
}
