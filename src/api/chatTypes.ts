/** Chat connections (docs/chat-plan.md, phase 2). People are the public id of their user; another guest is only ever a first name and a last initial. */

/** How a found person relates to the caller. `asked`: the caller already asked. `waiting`: they asked the caller. `approval`: waiting for a guardian. */
export type ChatRelation = 'none' | 'asked' | 'waiting' | 'approval' | 'connected'

export interface ChatPerson { id: string; name: string; relation: ChatRelation; /** Their chosen avatar id (see `src/domain/chatAvatar.ts`); absent for initials. */ avatar?: string }

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
  /** The other person's chosen avatar id; absent for initials. */
  avatar?: string
  /** Stanley's line for this request (what happens next, or a kind word after a no). Absent for a connection or an approval. */
  note?: string
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
  /** People you once agreed to chat with, whoever asked, with no block between you and no chat open now: still people you can invite to a group. */
  previous?: ChatConnection[]
}

/** How much a message matters (docs/chat-urgency-plan.md). Only `urgent` breaks through do not disturb; only staff and a guardian of a child in the chat may send it. */
export type ChatUrgency = 'normal' | 'important' | 'urgent'

/** `urgentUnacked` counts urgent messages from others that this guest has not acknowledged; `urgentConversations` are the conversations they are in (the same on every device). */
export interface ChatSummary {
  incoming: number; approvals: number; answers: number; newlyConnected: number; unread: number
  urgentUnacked: number; urgentConversations: string[]
  /** Chat events (someone declined, left a group or a personal chat) waiting in the Stanley thread for Got it. Absent from an older server. */
  infoNotices?: number
}

/** One-tap do not disturb: when it ends (milliseconds), or 0 when it is off. It ends by itself and follows the guest across devices. */
export interface ChatDnd { until: number }
export type ChatDndMode = 'hour' | 'morning' | 'off'

/** `typing`: show "is typing" to the others and see theirs (on unless turned off). */
/** `nickname` is the name shown in chat, empty when none is set (the username shows then). It is changed through `saveNickname`, never `saveSettings`. */
export interface ChatSettings { findable: boolean; showPreview: boolean; typing: boolean; nickname: string }

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
  /** Whether the guest has accepted the photo-sharing terms (shown the first time they send a photo). */
  photoTerms(): Promise<boolean>
  /** Records that they accepted the terms. */
  acceptPhotoTerms(): Promise<void>
  /** Sets the chat nickname (empty clears it). Rejects with `invalid` when it is not allowed. */
  saveNickname(nickname: string): Promise<ChatSettings>
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
export type ConversationKind = 'party' | 'direct' | 'group' | 'stanley' | 'channel' | 'room' | 'huddle'

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
  /** You are the admin of this made group (its creator). Absent when not. */
  admin?: boolean
  /** The permanent Stanley chat only: who he speaks for now, and the name shown under his. */
  voice?: StanleyVoice
  subtitle?: string
  /** Phase 8, a channel or room only: its rules, whether slow mode applies now and whether you may post. */
  room?: ChatRoomInfo
  /** Direct chat only: the id of the other person's chosen avatar (see `src/domain/chatAvatar.ts`); absent for the initials. */
  avatar?: string
  /** When the chat was started (milliseconds). */
  startedAt?: number
  /** When you last wrote a message here, and when someone else last did (milliseconds); absent when never. */
  lastMineAt?: number
  lastTheirsAt?: number
  /** You started this made group or private chat, so you can invite, remove people and delete it. Absent when not. */
  owner?: boolean
  /** The person who started this personal chat: shown with the Leader badge, and (unlike a group's leader) free to leave it. */
  leader?: boolean
  /** Card summary: messages in the chat and how many are yours, pins, and for your newest message how many others it went to, reached and were read by (read counts only where both sides share receipts). Absent when zero. */
  messageCount?: number
  mineCount?: number
  pinCount?: number
  lastMineTo?: number
  lastMineDelivered?: number
  lastMineSeen?: number
  /** The Stanley chat only: notices still waiting for your Got it. */
  waitingAck?: number
  /** More context: pictures shared, messages in the last 24 hours, unread messages that name you, the most active writer and how many they wrote, and (the leader) invitations still waiting. Absent when zero. */
  photoCount?: number
  dayCount?: number
  mentionsYou?: number
  topName?: string
  topCount?: number
  waitingInvites?: number
  /** How many of the other members have the app open right now (this server only). */
  onlineOthers?: number
  /** How long a reply usually takes, in seconds, and the hour (0-23, UTC) with the most messages; absent when there is not enough to say. */
  avgReplySeconds?: number
  busyHour?: number
  /** A made group or private chat only: who started it, and their chosen avatar (absent for initials). */
  ownerName?: string
  ownerAvatar?: string
}

/** Someone else in a conversation: their public id and first name with last initial. */
export interface ChatMember { id: string; name: string }

export interface ChatMessage {
  id: string
  from: string
  /** First name and last initial of someone else; absent for your own message. */
  fromName?: string
  /** The id of the sender's chosen avatar (see `src/domain/chatAvatar.ts`); only on someone else's message, and only when they chose one. */
  avatar?: string
  text: string
  at: number
  photo?: string
  /** A thread page says there is a photo without carrying it (it is large); fetch it once with `chatConversations.photo`. */
  hasPhoto?: boolean
  /** How many photos the message has, present only when there are two or more (phase 9b); `hasPhoto` covers the first. */
  photoCount?: number
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
export type ChatCardType = 'excursion' | 'dining' | 'booking' | 'portDay' | 'place' | 'plan' | 'venue' | 'menu'
export interface ChatCard { type: ChatCardType; title: string; subtitle?: string; day?: number; time?: string; place?: string; path?: string; expiresAt?: number; expired?: boolean; note?: string; /** What it points at was cancelled after it was sent. */ gone?: boolean }

/** One pinned message in the pin bar (up to three). `fromName` is absent for your own. */
export interface ChatPin { messageId: string; text: string; fromName?: string; at: number; kind?: 'card' | 'place' | 'plan' }

/** Something you can share from the app. `ref` is sent back to share it; the server rebuilds the card from its own data. */
export interface ChatShareable { ref: string; type: Exclude<ChatCardType, 'place' | 'plan' | 'venue' | 'menu'>; title: string; subtitle?: string; day?: number; time?: string }
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
export interface GroupStanley { on: boolean; canChange: boolean }

/** Phase 11: what an admin sees before posting a tally or sending a reminder. `shareText` and `reminderText` are exactly what would be posted and sent; `willRemind` is a count (nobody is named); `reason` says why a reminder cannot go now. */
export interface ChatCoordinatorPreview { status: string; compromise?: string; shareText: string; reminderText: string; willRemind: number; canRemind: boolean; reason?: 'closed' | 'tooSoon' | 'none' }
/** Phase 13: the text of a hand-off made only from the messages the guest chose. Nothing is sent by asking for it. */
export interface ChatRelayDraft { text: string; count: number; skipped: number; max: number }
export type RecapDecision = 'pending' | 'approved' | 'declined'
export interface ChatRecapPlan { messageId: string; title: string; day?: number; time?: string; place?: string; mine: boolean; decision: RecapDecision }
export interface ChatRecapPhoto { messageId: string; from?: string; mine: boolean; decision: RecapDecision }
/** The group recap as the caller may see it: before it is shared only their own parts and a count; after, only the approved parts. */
export interface ChatRecap { id: string; shared: boolean; startedAt: number; sharedAt?: number; decided: number; total: number; progress: string; plans: ChatRecapPlan[]; photos: ChatRecapPhoto[]; canShare: boolean; shareRefusal?: string }
export interface ChatRecapChoice { messageId: string; at: number; chosen: boolean }
export interface ChatReminded { reminded: number; line: string }
/** One poll or plan still waiting for someone: counts only. */
export interface ChatRemainingItem { messageId: string; kind: 'poll' | 'plan'; title: string; answered: number; total: number; closed: boolean; closesAt?: number }
export interface ChatRemaining { waiting: number; outstanding: number; items: ChatRemainingItem[] }

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

/** One photo, or the first of several with the rest in `more` (up to 9 more; phase 9b). */
export interface ChatPhotoInput { type: string; bytes: number; dataUrl: string; caption: string; more?: { type: string; bytes: number; dataUrl: string }[] }

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
  /** "Post this to the group?": an admin's confirmation of a shared Stanley card (a poll) in their own Stanley chat. Rejects `invalid` (`notMoment`, `group`), `forbidden` (`notAdmin`, `off`, `child`, `notGroup`), `notFound` or `conflict` (`already`). */
  shareMoment(id: string, messageId: string, groupId: string): Promise<void>
  /** Whether Stanley may offer to share cards in a made group, and whether the caller (an admin) can change it. */
  groupStanley(groupId: string): Promise<GroupStanley>
  setGroupStanley(groupId: string, on: boolean): Promise<GroupStanley>
  /** Admin only. The exact tally and reminder text for a poll or plan, and how many a reminder would reach. Rejects `forbidden` (`notAdmin`, `off`, `child`, `notGroup`), `invalid` (`notPoll`) or `notFound`. */
  coordinatorPreview(groupId: string, messageId: string): Promise<ChatCoordinatorPreview>
  /** Admin only: posts the tally to the group under "Alex asked Stanley to share this". Rejects as the preview does, or `tooMany` (`busy`). */
  shareTally(groupId: string, messageId: string): Promise<void>
  /** Admin only: reminds the people who have not answered, privately. Rejects as the preview does, or `conflict` (`closed`, `tooSoon`). */
  remindGroup(groupId: string, messageId: string): Promise<ChatReminded>
  /** Admin only: the open polls and plans that still wait for someone, in counts. */
  remaining(groupId: string): Promise<ChatRemaining>
  /** Get a person: the hand-off text from the chosen messages (one to ten). Sends nothing. Rejects `invalid` (`none`, `tooMany`), `forbidden` (`child`, `notChat`) or `notFound`. */
  relayDraft(id: string, messageIds: string[]): Promise<ChatRelayDraft>
  /** The group's recap, or rejects `notFound` when there is none yet. */
  recap(groupId: string): Promise<ChatRecap>
  /** Starts it (or returns it). Rejects `forbidden` (`notGroup`, `child`, `small`). */
  startRecap(groupId: string): Promise<ChatRecap>
  /** Your own photo messages you could add. */
  recapChoices(groupId: string): Promise<ChatRecapChoice[]>
  /** Which of your photos are in (at most six). Rejects `invalid` (`tooMany`, `notYours`) or `conflict` (`shared`). */
  setRecapPhotos(groupId: string, messageIds: string[]): Promise<ChatRecap>
  /** Approve or decline one of your own parts. Rejects `invalid` (`decision`), `notFound` or `conflict` (`shared`). */
  decideRecapPart(groupId: string, messageId: string, decision: 'approved' | 'declined'): Promise<ChatRecap>
  /** Shares it once every part is decided and one is approved. Rejects `conflict` (`waiting`, `empty`, `shared`). */
  shareRecap(groupId: string): Promise<ChatRecap>
  /** One approved photo of a shared recap as a data URL. */
  recapPhoto(groupId: string, messageId: string): Promise<string>
  /** Whether you switched Stanley's reminders off in this group. */
  remindersMuted(groupId: string): Promise<boolean>
  setRemindersMuted(groupId: string, muted: boolean): Promise<boolean>
  /** The photo of one message as a data URL. A photo never changes, so it can be kept. Rejects `notFound`. */
  photo(id: string, messageId: string, index?: number): Promise<string>
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
  /** You gave up on the message (cleared the box or left): the others' dots stop at once. Quiet on failure. */
  typingStop(id: string): Promise<void>
  /** Who is typing here now (first name and last initial); empty when you have the indicator off. */
  typingNow(id: string): Promise<string[]>
  /** Reports a person from the header, filed against their newest message you can read. Rejects `invalid` (`badReason`, `notInChat`) or `notFound` when they have said nothing. */
  reportPerson(id: string, personId: string, reason: string): Promise<void>
  /** Tells the connected people in this chat when you leave or return to the ship (off by default). Returns the new state; a supervised account is refused. */
  notifyAway(id: string, on: boolean): Promise<boolean>
  /**
   * Searches the words of your own chats (2 to 60 letters), or one chat with `conversation`. Newest first; pass the last `before` to read older hits. Rejects `invalid` (`query`) or `notFound`.
   * Never covers Stanley's chat, channels or rooms.
   */
  search(query: string, conversation?: string, before?: string): Promise<ChatSearchResult>
  /** Everything you may read of one of your chats, for saving as a file. Rejects `forbidden` (`notExportable`) or `notFound`. */
  exportChat(id: string): Promise<ChatExport>
  /** Whether Stanley's help (catch me up, make a plan, plain words) is on in this conversation, and whether you may switch it. Rejects `notFound`. */
  stanleyTap(id: string): Promise<ChatStanleyTap>
  /** The guest who made a group, or either person in a direct chat, turns Stanley's help off or on (asking him with `@Stanley` and the catch-up). Rejects `forbidden` (`notCreator`) or `notFound`. */
  setStanleyOff(id: string, off: boolean): Promise<ChatStanleyTap>
  /** You stop seeing Stanley's answers in this conversation (or see them again). Nobody is told. Rejects `forbidden` (`kind`) or `notFound`. */
  setStanleyMuted(id: string, muted: boolean): Promise<ChatStanleyTap>
  /**
   * A private summary of what you may read here. Never posted. Rejects `forbidden` (`kind`, `child`, `off`), `conflict` (`tooShort`), `invalid` with message `catchUpLimit` (three an hour) or `notFound`.
   */
  catchUp(id: string): Promise<ChatCatchUp>
  /** A poll preview made from one message; nothing is posted. Rejects `invalid` (`notMessage`, `noPlan`), `forbidden` (`kind`, `child`, `off`) or `notFound`. */
  makePlan(id: string, messageId: string): Promise<ChatPlanPreview>
  /** The cruise words in one message, in plain words. Rejects `invalid` (`notMessage`), `forbidden` (`kind`, `child`, `off`) or `notFound`. */
  explainWords(id: string, messageId: string): Promise<ChatTerm[]>
  /**
   * Stanley's private look at one message from someone else (money, gift cards, a number, another app, pressure) with polite replies to use. Nothing is sent or stored and the sender is not told.
   * Rejects `invalid` (`notMessage`), `forbidden` (`kind`, `child`, `off`, `urgent`, `stopped`) or `notFound`.
   */
  checkMessage(id: string, messageId: string): Promise<ChatMessageCheck>
  /** Counts that the guest used one of Stanley's suggestions (nothing about the text is kept). Never needed for the tap to work; rejects `invalid` (`kind`). */
  suggestionUsed(kind: 'reword' | 'icebreakers' | 'reply'): Promise<void>
  /** A short message to edit before sending. Nothing is sent. Rejects `invalid` (`draft`). */
  draftMessage(input: ChatDraftInput): Promise<string>
  /** Whether Stanley's friendly chat help is on for you, and the lines the request screens show. */
  stanleyStatus(): Promise<ChatStanleyStatus>
  /** One suggestion for a draft, only on your tap. Nothing is sent or stored. Rejects `invalid` (`mode`, `empty`) or `forbidden` (`supervised`). */
  reword(text: string, mode: ChatRewordMode): Promise<ChatReword>
  /** Up to three openers. `more` may use the model. Rejects `forbidden` (`supervised`). */
  icebreakers(more: boolean): Promise<ChatIcebreakers>
}

// ---- Stanley on tap in a thread (docs/chat-features-research.md, phase 10) ----

/** `reason` is `kind` (his own chat, a channel or a room), `child` (a supervised child is a member) or `off` (the creator turned it off) when `available` is false. */
export interface ChatStanleyTap { available: boolean; canSwitch: boolean; off: boolean; reason?: 'kind' | 'child' | 'off'; /** You chose not to see his answers in this conversation. */ muted?: boolean }
/** A private catch-up: short quotes with their speakers. `since` is the time of the oldest message it read. */
/** `written` is true when a model wrote `decided` and `open` from the same messages instead of quoting them; `latest` is always real quotes. */
export interface ChatCatchUp { label: string; messages: number; since: number; decided: string[]; open: string[]; latest: string[]; written?: boolean }
export interface ChatPlanPreview { question: string; options: string[] }
/** `key` is money, giftCard, phone, offApp or pressure. `worrying` is true when more than one thing, or money or gift cards, showed up. */
export interface ChatCheckFlag { key: 'money' | 'giftCard' | 'phone' | 'offApp' | 'pressure'; text: string }
export interface ChatMessageCheck { headline: string; flags: ChatCheckFlag[]; replies: string[]; note: string; worrying: boolean }
/** `usedShare` is absent until enough suggestions were given (the server's rule). `truncated` means a count hit its cap, so the numbers are a floor. */
export interface ChatStanleyUse { days: number; perDay: { date: string; calls: number }[]; byKind: { action: string; calls: number }[]; suggestions: number; used: number; usedShare?: number | null; truncated: boolean }
export interface ChatTerm { word: string; meaning: string }
/** `lines` are Stanley's wording keyed by what each is for: waiting, sent, expired, cooldown, tooManyOpen, tooMany, alreadyAsked, blocked. */
export interface ChatStanleyStatus { on: boolean; lines: Record<string, string> }
export type ChatRewordMode = 'reword' | 'friendlier' | 'shorter'
/** One suggestion, or none with a `reason` (`unavailable`, `limit`, `safety`, `none`). `message` is what Stanley says either way. */
export interface ChatReword { suggestion?: string; reason?: 'unavailable' | 'limit' | 'safety' | 'none'; message: string }
export interface ChatIcebreakers { lines: string[]; canMore: boolean }
export interface ChatDraftInput { kind: 'late' | 'meet'; minutes?: number; place?: string; time?: string }

// ---- Search and export (docs/chat-features-research.md, phase 9) ----

/** One message a search found. `from` is empty for your own message; `text` is a snippet around the match. */
export interface ChatSearchHit { conversationId: string; messageId: string; fromName: string; mine: boolean; text: string; at: number }
export interface ChatSearchResult { hits: ChatSearchHit[]; hasMore: boolean; /** Pass as `before` for the next, older page. */ before?: string }
export interface ChatExportLine { from: string; at: number; text: string; photo: boolean; system: boolean }
export interface ChatExport { name: string; at: number; lines: ChatExportLine[]; /** Only the newest messages are here. */ truncated: boolean }

// ---- Groups (docs/chat-plan.md, phase 5) ----

export interface ChatGroupMember { id: string; name: string; avatar?: string; you: boolean; creator: boolean; /** The second admin (the creator is always one). Absent when not. */ admin?: boolean; /** When they joined. */ joinedAt?: number; /** Their newest message here; absent when they have written none. */ lastMessageAt?: number; /** How many messages they wrote here. */ messages?: number; /** How many of them carry pictures. */ photos?: number; /** How many they wrote in the last 24 hours. */ day?: number; /** How long they usually take to answer someone else, in seconds; absent until they have. */ avgReplySeconds?: number; /** When they last used the app; absent when never. */ lastActiveAt?: number }

/** An invitation the creator is still waiting on. `needsGuardian`: the person is a child and their guardian must say yes. */
export interface ChatGroupWaiting { inviteId: string; personId: string; name: string; needsGuardian: boolean; avatar?: string }

/** A group as a member sees it. `id` is the conversation id. `waiting` is filled only for the creator. `max` is the size limit, the creator included. */
export interface ChatGroup { id: string; name: string; members: ChatGroupMember[]; waiting: ChatGroupWaiting[]; isCreator: boolean; max: number; /** Only admins post. Absent when not. */ announcementOnly?: boolean; /** You are an admin (the creator, or the second admin). Absent when not. */ isAdmin?: boolean }

/** `incoming` is for the guest; `approval` is for a child the guest is guardian of (`childId`, `childName`). `from` is the inviter's short name. */
export interface ChatGroupInvite {
  id: string
  kind: 'incoming' | 'approval' | 'outgoing'
  groupName: string
  from: string
  childId: string | null
  childName: string | null
  at: number
  expiresAt: number
  /** The inviter's chosen avatar id; absent for initials. */
  fromAvatar?: string
}

export interface ChatGroupsApi {
  /**
   * Makes a group from 2 to 24 connected people and invites each. Rejects `invalid` (`name`, `blocked`, `tooFew`, `tooMany`, `notConnected`, `noGuardian`)
   * or `forbidden` (`supervised`: a child cannot make a group).
   */
  /** `personIds` are people already chatted with; `invitePersonIds` are people found by searching, invited straight into the group. */
  create(name: string, personIds: string[], invitePersonIds?: string[]): Promise<ChatGroup>
  /** Rejects `notFound` unless you are an active member. */
  get(id: string): Promise<ChatGroup>
  /** Creator only. Rejects `invalid` (`name`, `blocked`) or `forbidden` (`creator`). */
  rename(id: string, name: string): Promise<ChatGroup>
  /** Creator only. Rejects `invalid` (`person`, `notConnected`, `noGuardian`), `forbidden` (`creator`) or `conflict` (`full`). */
  invite(id: string, personIds: string[], invitePersonIds?: string[]): Promise<ChatGroup>
  /** An admin: only admins post, or everyone again. Rejects `forbidden` (`admin`). */
  setAnnouncementOnly(id: string, on: boolean): Promise<ChatGroup>
  /** Creator only; never themself. */
  remove(id: string, personId: string): Promise<void>
  /** Creator only: takes back an invitation nobody has answered. Rejects `conflict` (`answered`). */
  revokeInvite(id: string, inviteId: string): Promise<void>
  /** The creator deletes the whole group for everyone. */
  delete(id: string): Promise<void>
  leave(id: string): Promise<void>
  invites(): Promise<ChatGroupInvite[]>
  /** The invitations you sent that nobody has answered yet (`from` is who each is for). */
  sentInvites(): Promise<ChatGroupInvite[]>
  /** Takes back one of them; the other person's list drops it. Rejects `conflict` once answered. */
  revokeSent(id: string): Promise<void>
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


// ---- Channels and rooms (docs/chat-features-research.md, phase 8) ----

/** What a channel or room adds to its conversation. `why` (when `canPost` is false): off, left, closed, staffOnly, muted. `rulesAccepted` is false until the guest has said yes to `rules` (asked on the first post). */
export interface ChatRoomInfo { roomKind: string; topic?: string; rules: string; slow: boolean; rulesAccepted: boolean; canPost: boolean; why?: string; staffOnly: boolean; members: number }

/** A channel or room in the directory. `joined`: you follow or are in it. `blocked`: why you cannot join (off, child, closed, noBooking, full, removed), absent when you can. */
export interface ChatRoomListItem { id: string; kind: 'channel' | 'room'; roomKind?: 'sailing' | 'interest'; name: string; topic?: string; members: number; joined: boolean; blocked?: string; closed: boolean }

/** What you may read of a room before joining: its rules and what staff chose to show. Never a guest's own post. */
export interface ChatRoomPreview { id: string; kind: 'channel' | 'room'; name: string; rules: string; lines: { text: string; at: number }[]; questions: string[] }

export interface ChatRoomsApi {
  list(): Promise<ChatRoomListItem[]>
  /** Rejects `notFound` for a room that is not open to you. */
  preview(id: string): Promise<ChatRoomPreview>
  /** Follows a channel or joins a room, muted. Rejects `forbidden` (`child`, `noBooking`, `removed`), `notFound` or `conflict` (`off`, `closed`, `full`). */
  join(id: string): Promise<unknown>
  leave(id: string): Promise<void>
  /** Says yes to the rules. */
  acceptRules(id: string): Promise<void>
  /** Suggests a question for the room's popular ones. Rejects `invalid` (`text`, `contactInfo`, `blocked`), `forbidden` (`child`), `notFound` or `tooMany`. */
  suggestQuestion(id: string, text: string): Promise<void>

  // ---- Stanley as host (phase 12) ----

  /** The meet-ups of a room or made group, newest first. */
  meetUps(id: string): Promise<ChatMeetUp[]>
  /** Starts a meet-up, posted as the guest's own words. Rejects `invalid` (`text`), `forbidden` (`supervised`), `conflict` (`off`, `closed` and the room's own refusals), `notFound` or `tooMany` (`limit`). */
  startMeetUp(id: string, title: string, place?: string): Promise<ChatMeetUp>
  /** Answers in, maybe or no; it can change. */
  answerMeetUp(meetUpId: string, answer: MeetUpAnswer): Promise<ChatMeetUp>
  /** Where "introduce me" stands in this room. */
  introStatus(id: string): Promise<ChatIntro>
  /** Asks to be introduced. Rejects `invalid` (`unknown`), `forbidden` (`supervised`, `notAdult`), `conflict` (`off`, `notRoom`), `notFound` or `tooMany` (`limit`). */
  introOptIn(id: string, interest: string): Promise<ChatIntro>
  /** Takes back every live request. */
  introWithdraw(): Promise<void>
  /** The welcome line (null when Stanley is quiet here), the rules and what he can answer. */
  welcome(id: string): Promise<ChatHostWelcome>
  /** A question in a room: a library answer (also posted to the room) or the plain "ask Guest Services" words. */
  askRoom(id: string, text: string): Promise<ChatHostAnswer>
  /** Flags a post to staff. Rejects `invalid` (`unknown`), `forbidden` (`supervised`), `notFound` or `tooMany` (`limit`). */
  flag(messageId: string, reason: HostFlagReason): Promise<void>
}

/** Phase 12: Stanley as host for strangers and room host. */
export type MeetUpAnswer = 'in' | 'maybe' | 'no'
/** In and maybe are counted; a decline is never counted or shown. `mine` is the caller's own answer. */
export interface ChatMeetUp { id: string; title: string; place?: string; in: number; maybe: number; mine?: MeetUpAnswer; started: boolean; at: number }
export type IntroState = 'none' | 'waiting' | 'introduced'
export interface ChatIntro { state: IntroState; interest?: string; endsAt?: number; name?: string; interests: string[] }
export interface ChatHostWelcome { line?: string; rules: string; topics: string[] }
export interface ChatHostAnswer { answered: boolean; text: string }
export type HostFlagReason = 'spam' | 'unsafe' | 'rude' | 'other'

// ---- Staff screens for channels and rooms (phase 8c; administrators only) ----

/** A channel or room as staff see it. `inHours`: moderators are on duty now (otherwise slow mode is on by itself). */
export interface ChatRoomAdminItem { id: string; kind: 'channel' | 'room'; roomKind?: 'sailing' | 'interest'; name: string; topic?: string; sailingId?: string; members: number; cap: number; moderators: number; closed: boolean; slow: boolean; inHours: boolean; rules: string }

/** A post held for a link, phone number or email. `from` is a first name and last initial. */
export interface ChatHeldPost { id: string; roomId: string; roomName: string; from: string; text: string; reason: string; at: number }

/** A question a guest suggested for a room's popular ones. No names. */
export interface ChatSuggestedQuestion { id: string; roomId: string; roomName: string; text: string; at: number }

/** Counts only: no message text and no guest names. */
export interface ChatRoomSummary { days: number; reports: number; actions: { action: string; count: number }[]; busiest: { id: string; name: string; posts: number }[]; noModerator: { id: string; name: string; moderators: number }[]; held: number }

export interface ChatRoomCreate { kind: 'channel' | 'room'; roomKind?: 'sailing' | 'interest'; name: string; topic?: string; sailingId?: string; cap?: number; rules?: string }

export type ChatRoomStaffAction = { action: 'slow'; on: boolean } | { action: 'open' } | { action: 'close' } | { action: 'rules'; rules: string } | { action: 'moderator' | 'unmoderator'; personId: string }

/** A live post as staff see it. `from` is a first name and last initial; `fromId` is for a person action. */
export interface ChatRoomPost { id: string; fromId: string; from: string; text: string; at: number; pinned: boolean }

/** An active member as staff see them. */
export interface ChatRoomPerson { id: string; name: string; muted: boolean; mutedUntil?: number }

/** An administrator who could be on a room's rota. */
export interface ChatRoomModerator { id: string; name: string; named: boolean }

export type ChatRoomMute = 'hour' | 'day' | 'room'

export interface ChatRoomsStaffApi {
  posts(id: string): Promise<ChatRoomPost[]>
  people(id: string): Promise<ChatRoomPerson[]>
  rota(id: string): Promise<ChatRoomModerator[]>
  /** Rejects `notFound` for a post that is gone, `conflict` (`pinsFull`) when three are pinned. */
  message(id: string, messageId: string, action: 'remove' | 'pin'): Promise<void>
  /** Rejects `notFound` when the person is no longer in the room. */
  person(id: string, personId: string, action: 'mute' | 'unmute' | 'remove', mute?: ChatRoomMute): Promise<void>
  list(): Promise<ChatRoomAdminItem[]>
  /** Rejects `invalid` (`kind`, `roomKind`, `name`, `topic`, `sailing`, `rules`, `cap`) or `forbidden`. */
  create(body: ChatRoomCreate): Promise<unknown>
  /** Rejects `conflict` (`rota`) when a room is opened without two moderators. */
  act(id: string, body: ChatRoomStaffAction): Promise<unknown>
  held(): Promise<ChatHeldPost[]>
  decideHeld(id: string, decision: 'release' | 'reject'): Promise<void>
  questions(): Promise<ChatSuggestedQuestion[]>
  decideQuestion(id: string, decision: 'popular' | 'reject'): Promise<void>
  summary(days?: number): Promise<ChatRoomSummary>
  /** Stanley in chat for staff (stanley plan, phase 7): calls per day and the share of suggestions used. Counts only. `days` is 1 to 30. */
  stanleyUse(days?: number): Promise<ChatStanleyUse>
  /** Posts guests asked Stanley to flag (phase 12), oldest first. No words: the room, the reason and when. */
  hostFlags(): Promise<ChatHostFlag[]>
  /** Marks a flag looked at. Rejects `notFound` when it is gone or already decided. */
  decideHostFlag(id: string): Promise<void>
}

/** A flag a guest raised on a post. The post's words are not here; staff read it in the room's posts. */
export interface ChatHostFlag { id: string; roomId: string; roomName: string; messageId: string; reason: HostFlagReason; at: number }

export type AvatarGroup = 'people' | 'sketch' | 'robots' | 'critters' | 'pixel' | 'abstract'

/** One picture in the chat avatar catalogue (phase 9c); the picture itself is at `/public/avatars/{id}`. */
export interface AvatarChoice {
  id: string
  /** What a screen reader says, for example "Robot 1". */
  label: string
  group: AvatarGroup
}
