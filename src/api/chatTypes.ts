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

/** `typing`: show "is typing" to the others and see theirs (on unless turned off). */
export interface ChatSettings { findable: boolean; showPreview: boolean; typing: boolean }

/** Why chat by text cannot be turned on: a child's account, no number on the profile, a number not yet confirmed, or switched off for everyone. */
export type ChatSmsReason = 'supervised' | 'noPhone' | 'unverified' | 'off'

/** Chat by text for a guest ashore. `on` is the choice; `idle` also counts 30 minutes with the app closed as ashore; `available` is whether it can be turned on. */
export interface ChatSms { on: boolean; idle: boolean; available: boolean; reason: ChatSmsReason | null }

/** What chat the guest may use now, decided on the server from their journey stage and bookings. `reason` is `beforeBooking` when only Stanley is on. It governs starting new chats; chats already there stay readable. */
export interface ChatEligibility { stage: string; stanley: boolean; party: boolean; people: boolean; guestServices: boolean; keep: boolean; reason?: 'beforeBooking' }

/** Why a chat cannot be kept: the Stanley chat, an ended chat, no trip to count from, or the standard date has passed. */
export type ChatKeepReason = 'permanent' | 'closed' | 'noTrip' | 'tooLate'

/**
 * Whether one conversation is kept past the standard 30 days after the cruise. It is kept only when every person in it has agreed (`agreed` of `total`); `waiting` are the others who have not.
 * `standardDeleteOn` is the day the messages go by default and `deleteOn` the day they go if kept (12 months after the cruise); both are the day itself in epoch ms (UTC midnight).
 * `needsGuardian`: the viewer is a supervised child, whose guardian decides.
 */
export interface ChatKeep {
  id: string
  available: boolean
  mine: boolean
  kept: boolean
  agreed: number
  total: number
  waiting: string[]
  standardDeleteOn: number | null
  deleteOn: number | null
  needsGuardian: boolean
  reason?: ChatKeepReason
}

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
  /** The suggestion topics Stanley may use in the chat, the ones switched off and the mode the guest's Stanley level gives. */
  stanleyPrefs(): Promise<StanleyChatPrefs>
  /** Saves the topics switched off. Rejects `invalid` (`topics`). */
  saveStanleyPrefs(topicsOff: string[]): Promise<StanleyChatPrefs>
  saveSettings(settings: ChatSettings): Promise<ChatSettings>
  sms(): Promise<ChatSms>
  /** Rejects `invalid` (`noPhone`, `unverified`, `off`) or `forbidden` (`supervised`) when it cannot be turned on. */
  saveSms(on: boolean, idle: boolean): Promise<ChatSms>
  /** Hide me: not findable, every chat ended, every waiting request withdrawn. Returns the new settings. */
  hide(): Promise<ChatSettings>
  /** What chat the caller may use at their stage. */
  eligibility(): Promise<ChatEligibility>
  /** Keeping, for every conversation that can be kept, so the list can say which are. */
  keeps(): Promise<ChatKeep[]>
}

// ---- Conversations and messages (docs/chat-plan.md, phase 4) ----

/** `stanley` is every account's permanent 1:1 chat with Stanley (docs/chat-features-research.md, section 15): it cannot be left, muted, ended or removed. */
export type ConversationKind = 'party' | 'direct' | 'group' | 'stanley'

/** Who Stanley speaks for: the company before and after the trip, the ship while aboard. The server decides; the screen shows the subtitle it is given. */
export type StanleyVoice = 'company' | 'ship'

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
  /** You tell the connected people in this chat when you leave or return to the ship. Off unless you chose it; absent when off. */
  notifyAway?: boolean
  /** The permanent Stanley chat: no leave, mute, archive, block or hide controls. */
  permanent?: boolean
  /** The other people in it (not the permanent Stanley chat), for the header's Block and Report. */
  people?: ChatMember[]
  /** You moved it to your archive; a new message from someone else brings it back unless it is muted. Absent when not. */
  archived?: boolean
  /** A timed mute: when it ends (milliseconds). Absent when the mute has no end, or when not muted. */
  mutedUntil?: number
  /** You may pin and unpin here (either person in a direct chat, anyone in the booking's group, the creator of a made group). Absent when not. */
  canPin?: boolean
  /** You are alerted only when someone mentions you here (it still shows and counts everything). Absent when off. */
  mentionsOnly?: boolean
  /** Phase 4, a made group: only admins post (votes, answers and reactions stay open). Absent when not. */
  announcementOnly?: boolean
  /** You are an admin of this made group (its creator, or the one other person the creator named). Absent when not. */
  admin?: boolean
  /** The permanent Stanley chat only: who he speaks for now, and the name shown under his. */
  voice?: StanleyVoice
  subtitle?: string
}

/** Someone else in a conversation: their public id and first name with last initial. */
export interface ChatMember { id: string; name: string }

export interface ChatMessage {
  id: string
  from: string
  /** First name and last initial of someone else; absent for your own message. */
  fromName?: string
  text: string
  at: number
  photo?: string
  /** A thread page says there is a photo without carrying it (it is large); fetch it once with `chatConversations.photo`. */
  hasPhoto?: boolean
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
  /** Sent by Stanley (a notice, a card or a line marking a change of voice), not by a person. */
  stanley?: boolean
  /** On a Stanley message: the name shown under his when it was sent, so earlier lines keep the voice they had. */
  subtitle?: string
  /** On a relayed company or ship notice (phase 0b): its lane, the screen it links to and whether it can still be acted on. */
  notice?: ChatNotice
  /** The chips under it (phase 1), one per emoji in use. Absent when there are none. */
  reactions?: ChatReaction[]
  /** What it answers (phase 1): a quote of the original, or "Message removed" when you may not read the original any more. */
  replyTo?: ChatQuote
  /** Yours: a device of someone else has it (both of you have read receipts on). `read` beats it. */
  delivered?: boolean
  /** The sender fixed the text inside the 15-minute window (phase 2). */
  edited?: boolean
  /** The sender deleted it for everyone: `text` is empty and there is no photo, quote or chips (phase 2). */
  deleted?: boolean
  /** Phase 3: `card` (something shared from the app) or `place` (a meeting point). Absent for text and photos. `text` then holds the words the list and alerts use; the screen draws `card`. */
  kind?: 'card' | 'place' | 'plan' | 'poll'
  card?: ChatCard
  /** Phase 4, a poll: the question and its options (the words come from the person who asked). */
  poll?: ChatPoll
  /** Phase 4, a poll or a plan: the answers as you see them. */
  tally?: ChatTally
  /** It is one of the pinned messages in this conversation. */
  pinned?: boolean
  /** It mentions you by name (it breaks through a muted chat). */
  mentionsYou?: boolean
  /** The public ids of the members it mentions. */
  mentions?: string[]
}

/** A card or place as the server built it: a title and where it applies, never a price, cabin or booking number. `expired` is set on a place whose time has passed; `path` is the screen it opens. */
export type ChatCardType = 'excursion' | 'dining' | 'booking' | 'portDay' | 'place' | 'plan'
export interface ChatCard { type: ChatCardType; title: string; subtitle?: string; day?: number; time?: string; place?: string; path?: string; expiresAt?: number; expired?: boolean; note?: string; /** What it points at was cancelled after it was sent. */ gone?: boolean }

/** One pinned message in the pin bar (up to three). `fromName` is absent for your own. */
export interface ChatPin { messageId: string; text: string; fromName?: string; at: number; kind?: 'card' | 'place' | 'plan' }

/** Something you can share from the app. `ref` is sent back to share it; the server rebuilds the card from its own data. */
export interface ChatShareable { ref: string; type: Exclude<ChatCardType, 'place' | 'plan'>; title: string; subtitle?: string; day?: number; time?: string }
/** A named place on the ship a meeting point can be dropped at. */
export interface ChatPlace { id: string; name: string; deck: number; section: string }
/** A programme event on a day your own sailing runs it, which a plan can be made of. `ref` (`eventId:day`) is sent back to make the plan. */
export interface ChatPlannable { ref: string; title: string; day: number; time: string; place?: string }
export interface ChatShareables { items: ChatShareable[]; places: ChatPlace[]; events?: ChatPlannable[] }

/** A poll: a question and two to five options. */
export interface ChatPoll { question: string; options: string[] }
/**
 * The answers to a poll or plan. `counts` is one number per poll option, or going, maybe and no for a plan; `mine` is your own choice (the option's index, or 0, 1, 2 for a plan). A poll's answers are counted, never named.
 * `closesAt` (ship milliseconds) and `mayClose` are for a poll; `going` names the others going to a plan; `addedToPlan` says your Going put the event on your own programme.
 */
export interface ChatTally { counts: number[]; mine?: number; closed: boolean; closesAt?: number; mayClose: boolean; going?: string[]; addedToPlan?: boolean }
export type ChatRsvp = 'going' | 'maybe' | 'no'

/** What a typed send carries: a `ref` from the shareable list, or a named place and an optional short note. */
export type ChatTypedSend =
  | { kind: 'card'; shareRef: string }
  | { kind: 'place'; placeId: string; note?: string }
  | { kind: 'plan'; shareRef: string; note?: string }
  | { kind: 'poll'; question: string; options: string[] }

/** One of the six reactions in use on a message. `names` are the others (first name and last initial) for a screen reader; yours is counted and marked by `mine`, not named. */
export interface ChatReaction { emoji: string; count: number; mine: boolean; names: string[] }

/** The quote above a reply. `id` is absent when `removed`; `fromName` is absent for your own message. */
export interface ChatQuote { id?: string; text: string; fromName?: string; mine?: boolean; removed?: boolean }

/** The lane decides how a relayed notice looks and behaves; the server sets it and the screen only shows it. */
export type NoticeLane = 'critical' | 'important' | 'reminder' | 'info' | 'suggestion'
/**
 * `expiresAt` (ship milliseconds) lets a copy held on the device stop offering actions when the time passes without asking the server. `actions` are ids the screen turns into buttons
 * (`confirmMuster` calls the muster service, `reviewChange` shows the change card named by `subject` with its options; the rest open the screen that does the job) and `replies` are the chips; both are empty once the notice is replaced or expired.
 */
export interface ChatNotice { lane: NoticeLane; kind: string; path: string; expired: boolean; superseded: boolean; expiresAt?: number; actions?: string[]; replies?: NoticeReply[]; subject?: string }
export type NoticeReply = 'why' | 'what' | 'later'
/** What the guest's Stanley level gives: `off` posts no suggestion, `trip` only what affects the trip, `suggest` adds suggestions, `guide` adds a step-by-step. */
export type MomentMode = 'off' | 'trip' | 'suggest' | 'guide'
export interface StanleyChatPrefs { topics: string[]; topicsOff: string[]; mode: MomentMode }
/** Stanley's answer to a chip. `remindAt` is set when the reply was Remind me later. */
export interface NoticeReplyAnswer { text: string; remindAt?: number }

/** `ashore`: people in it who are ashore and answer by text, so a reply is not expected at once. */
/** `mayUrgent`: you may send an urgent message here (staff, or a guardian of a child in it). */
/** `firstUnread`: the first message from someone else you had not read when the thread was fetched (latest page only), for the "New messages" divider. */
export interface ChatThread { conversation: ChatConversation; messages: ChatMessage[]; hasMore: boolean; ashore?: string[]; mayUrgent?: boolean; firstUnread?: string; /** The pin bar, on the latest page only. */ pins?: ChatPin[]; /** Phase 4 follow-up, latest page only: people back on the ship who chose to tell this chat when they leave or return and whom you are connected to. */ back?: string[] }

export interface ChatPhotoInput { type: string; bytes: number; dataUrl: string; caption: string }

export interface ChatConversationsApi {
  list(): Promise<ChatConversation[]>
  /** Whether the conversation is kept past 30 days. Rejects `notFound` for one you are not in. */
  keep(id: string): Promise<ChatKeep>
  /** Agrees to keep it, or takes that back; it is kept once everyone has agreed. Rejects `forbidden` (`guardian`, `stanley`), `conflict` (`closed`, `noTrip`, `tooLate`) or `notFound`. */
  setKeep(id: string, on: boolean): Promise<ChatKeep>
  /** The latest 30 messages, or the page before the message `before`. Rejects `notFound` for a conversation you are not in. */
  thread(id: string, before?: string): Promise<ChatThread>
  /**
   * `clientId` makes a retry safe: a repeat returns the stored message. Rejects `invalid` (`blocked`: the word filter, nothing was sent; `text`; `contactInfo`),
   * `conflict` (`closed`) or `notFound`. `urgency` is normal when left out; urgent rejects `forbidden` (`urgency`) unless you may send it, and an unknown level rejects `invalid` (`urgency`). `replyTo` is the message being answered; one you cannot read rejects `invalid` (`replyTo`).
   */
  send(id: string, text: string, clientId: string, urgency?: ChatUrgency, replyTo?: string, mentions?: string[]): Promise<ChatMessage>
  /**
   * Sends a card from the shareable list or a meeting place (phase 3). The server builds the words from its own data. Rejects `invalid` (`shareRef`: not yours or not booked any more; `place`; `blocked` or `contactInfo` for a note; `kind`),
   * `conflict` (`closed`) or `notFound`. It is not held for later: a card needs the server to say it is still true.
   */
  sendTyped(id: string, input: ChatTypedSend, clientId: string, mentions?: string[]): Promise<ChatMessage>
  /** What you can share, and where you can ask to meet. */
  shareable(): Promise<ChatShareables>
  /** Pins (up to three) or unpins a message and returns the pin bar. Rejects `invalid` (`notMessage`), `forbidden` (`pin`, `stanley`), `conflict` (`pinsFull`, `closed`) or `notFound`. */
  pin(id: string, messageId: string, on: boolean): Promise<ChatPin[]>
  /** Votes for one option of a poll, or changes your vote until it closes. Returns the counts. Rejects `invalid` (`option`, `notPoll`), `forbidden` (`stanley`), `notFound` or `conflict` (`pollClosed`, `closed`). */
  vote(id: string, messageId: string, option: number): Promise<ChatTally>
  /** Closes a poll early (the person who asked it, or an admin). Returns the counts. Rejects `forbidden` (`close`), `invalid` (`notPoll`), `notFound` or `conflict` (`closed`). */
  closePoll(id: string, messageId: string): Promise<ChatTally>
  /** Answers a plan. Going puts its event on your programme when your sailing runs it that day (a child's answer never does); another answer takes it off if the plan put it there. Rejects `invalid` (`choice`, `notPlan`), `notFound` or `conflict` (`closed`). */
  rsvp(id: string, messageId: string, choice: ChatRsvp): Promise<ChatTally>
  /** Alerts you only for a mention in this conversation. Returns the new state. Rejects `forbidden` (`stanley`) or `notFound`. */
  mentionsOnly(id: string, on: boolean): Promise<boolean>
  /**
   * Reacts with one of the six emoji (`REACTIONS`): a different one replaces yours, the same one again takes it away. Returns the chips now under the message.
   * Rejects `invalid` (`emoji`, `notMessage`), `forbidden` (`stanley`), `notFound` or `conflict` (`closed`).
   */
  react(id: string, messageId: string, emoji: string): Promise<ChatReaction[]>
  /**
   * Sets your reaction to exactly `emoji`, or clears it with null. Unlike `react` it is idempotent, so it is the one a queued tap uses: replaying it after a reconnect cannot undo anything.
   * Rejects as `react` does.
   */
  setReaction(id: string, messageId: string, emoji: string | null): Promise<ChatReaction[]>
  /** This device has the messages others sent here, so their senders can show Delivered. Idempotent; rejects `notFound`. */
  delivered(id: string): Promise<void>
  /** Rejects `invalid` (`type`, `size`, `empty`, `contactInfo`, `blocked`), `forbidden` (`age`), `conflict` (`closed`) or `notFound`. */
  sendPhoto(id: string, input: ChatPhotoInput): Promise<ChatMessage>
  /** "Got it" on an urgent message from someone else; repeating it changes nothing. Rejects `invalid` (`notUrgent`) or `notFound`. */
  ack(id: string, messageId: string): Promise<void>
  /** A chip on a relayed Stanley notice. Rejects `invalid` (`reply`, `notNotice`), `notFound` or `conflict` (`expired`, for Remind me later). */
  noticeReply(id: string, messageId: string, reply: NoticeReply): Promise<NoticeReplyAnswer>
  /** Not now (`snooze`: it may come back tomorrow) or Don't show again (`dismiss`: until what it is about changes) on a Stanley suggestion card. Rejects `invalid` (`action`, `notMoment`), `forbidden` or `notFound`. */
  momentAction(id: string, messageId: string, action: 'snooze' | 'dismiss'): Promise<void>
  /** The photo of one message as a data URL. A photo never changes, so it can be kept. Rejects `notFound`. */
  photo(id: string, messageId: string): Promise<string>
  /** Marks everything read, on every device. */
  read(id: string): Promise<void>
  /** Returns the new state. `length` (`hour`, `day` or `week`) ends the mute by itself; without it the mute lasts until turned off. Rejects `invalid` (`for`) or `forbidden` (`stanley`). */
  mute(id: string, on: boolean, length?: 'hour' | 'day' | 'week'): Promise<boolean>
  /** Moves the chat into your archive or back. Returns the new state. Rejects `forbidden` (`stanley`). */
  archive(id: string, on: boolean): Promise<boolean>
  /**
   * Fixes the text of your own message within 15 minutes of sending. Returns the message. Rejects `invalid` (`text`, `blocked`, `contactInfo`, `photo`, `urgent`), `forbidden` (`notYours`),
   * `conflict` (`tooLate`, `deleted`, `closed`) or `notFound`.
   */
  edit(id: string, messageId: string, text: string): Promise<ChatMessage>
  /** Deletes your own message for everyone within 15 minutes of sending; repeating it changes nothing. Rejects `forbidden` (`notYours`), `conflict` (`tooLate`, `closed`) or `notFound`. */
  remove(id: string, messageId: string): Promise<void>
  /** You are typing. Quiet on failure; the server sends at most one nudge in three seconds and does nothing when you have the indicator off. */
  typing(id: string): Promise<void>
  /** Who is typing here now (first name and last initial); empty when you have the indicator off. */
  typingNow(id: string): Promise<string[]>
  /** Reports a person from the header, filed against their newest message you can read. Rejects `invalid` (`badReason`, `notInChat`) or `notFound` when they have said nothing. */
  reportPerson(id: string, personId: string, reason: string): Promise<void>
  /** Tells the connected people in this chat when you leave or return to the ship (off by default). Returns the new state; a supervised account is refused. */
  notifyAway(id: string, on: boolean): Promise<boolean>
}

// ---- Groups (docs/chat-plan.md, phase 5) ----

export interface ChatGroupMember { id: string; name: string; you: boolean; creator: boolean; /** The second admin (the creator is always one). Absent when not. */ admin?: boolean }

/** An invitation the creator is still waiting on. `needsGuardian`: the person is a child and their guardian must say yes. */
export interface ChatGroupWaiting { inviteId: string; personId: string; name: string; needsGuardian: boolean }

/** A group as a member sees it. `id` is the conversation id. `waiting` is filled only for the creator. `max` is the size limit, the creator included. */
export interface ChatGroup { id: string; name: string; members: ChatGroupMember[]; waiting: ChatGroupWaiting[]; isCreator: boolean; max: number; /** Only admins post. Absent when not. */ announcementOnly?: boolean; /** You are an admin (the creator, or the second admin). Absent when not. */ isAdmin?: boolean }

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
  /** Creator only: names or releases the second admin (one beside the creator; a child is never one). Rejects `invalid` (`self`, `child`, `person`), `forbidden` (`creator`) or `conflict` (`adminsFull`). */
  setAdmin(id: string, personId: string, on: boolean): Promise<ChatGroup>
  /** An admin: only admins post, or everyone again. Rejects `forbidden` (`admin`). */
  setAnnouncementOnly(id: string, on: boolean): Promise<ChatGroup>
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
  /** Whether the child's conversation is kept, and the child's agreement, which only the guardian gives. */
  keep(childId: string, conversationId: string): Promise<ChatKeep>
  /** The guardian agrees to keep the child's conversation, or takes that back. Rejects `conflict` (`closed`, `noTrip`, `tooLate`) or `notFound`. */
  setKeep(childId: string, conversationId: string, on: boolean): Promise<ChatKeep>
}
