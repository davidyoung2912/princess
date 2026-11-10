namespace Princess.Api.Data;

public sealed class SelectionRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public string ItemId { get; set; } = "";
    /// <summary>0 for items with no day (shop goods).</summary>
    public int Day { get; set; }
    /// <summary>"HH:mm" ship time, or "" for items with no time.</summary>
    public string Time { get; set; } = "";
    public int Qty { get; set; }
    public long TotalCents { get; set; }
    public DateTime At { get; set; }
}

public sealed class ServiceRequestRow
{
    public Guid PublicId { get; set; }
    public string ItemId { get; set; } = "";
    public int Qty { get; set; }
    public string Note { get; set; } = "";
    public DateTime PlacedAt { get; set; }
    /// <summary><c>received</c> until the guest cancels it (<c>cancelled</c>); the rest of the stages are worked out from the clock.</summary>
    public string Stage { get; set; } = "received";
    /// <summary>Escalations, confirmations and reopens, oldest first. A reopen never removes the earlier ones.</summary>
    public List<ServiceRequestEventRow> Events { get; set; } = [];
}

public sealed class ServiceRequestEventRow
{
    /// <summary><c>escalated</c>, <c>confirmed</c> or <c>reopened</c>.</summary>
    public string Kind { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class SafetyReportRow
{
    public Guid PublicId { get; set; }
    public string Kind { get; set; } = "";
    public string Place { get; set; } = "";
    public string Note { get; set; } = "";
    public bool Anonymous { get; set; }
    public string Reference { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class DrinkLogRow
{
    public Guid PublicId { get; set; }
    public string DrinkId { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class TopUpRow
{
    public Guid PublicId { get; set; }
    public int Dollars { get; set; }
    public string Source { get; set; } = "card";
    public DateTime At { get; set; }
    public DateTime? SettledAt { get; set; }
    public string Reference { get; set; } = "";
}

/// <summary>The booking's on-board account settings. The PIN is kept as a salted PBKDF2 hash.</summary>
public sealed class OnboardAccountRow
{
    public byte[]? PinHash { get; set; }
    public byte[]? PinSalt { get; set; }
    public int PinFails { get; set; }
    public string GratuityChoice { get; set; } = "standard";
    public string? GratuityReason { get; set; }
    public DateTime? GratuityPaidAt { get; set; }
    public string DisplayCurrency { get; set; } = "USD";
    public bool Exists { get; set; }
}

public sealed class PartyRow
{
    public Guid PublicId { get; set; }
    public string Title { get; set; } = "";
    public int Day { get; set; }
    public string Time { get; set; } = "";
    public List<(string Cabin, string Answer)> Invites { get; set; } = [];
}

/// <summary>A group dining table: the friends on it, how the bill is split and how many of the booking are seated.</summary>
public sealed class GroupTableRow
{
    public long ReservationId { get; set; }
    public string Split { get; set; } = "mine";
    public int PartySize { get; set; }
    public List<(int Seq, string Name, string Cabin)> Friends { get; set; } = [];
}

/// <summary>Someone who shares a conversation with the person: the public id and short name the screens use, and whether they show read receipts.</summary>
public sealed class ChatPeerRow
{
    public long UserId { get; set; }
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public bool ReceiptsOn { get; set; }
    /// <summary>active, left or removed. The people shown as "in" a conversation are the active ones; the others are kept so earlier messages still have a name.</summary>
    public string Status { get; set; } = "active";
    /// <summary>Set only by <see cref="IChatStore.ListMembersForAsync"/>: the conversation this row belongs to.</summary>
    public long GroupId { get; set; }
    /// <summary>A supervised child's account: a guardian can read the conversations they are in.</summary>
    public bool IsSupervised { get; set; }
    /// <summary>The booker of a supervised child (their guardian); null for anyone else.</summary>
    public long? BookerUserId { get; set; }
}

public sealed class ChatMessageRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long FromUserId { get; set; }
    public string Text { get; set; } = "";
    public string? Photo { get; set; }
    /// <summary>A thread page leaves <see cref="Photo"/> out (it is a large data URL) and says only that there is one; the app fetches it once by message.</summary>
    public bool HasPhoto { get; set; }
    public DateTime At { get; set; }
    /// <summary>A line about the group ("Sam left the group"), not something a person said: shown in the thread, never counted as unread.</summary>
    public bool IsSystem { get; set; }
    /// <summary>It came in by text from a guest ashore (docs/chat-plan.md, phase 6).</summary>
    public bool ViaSms { get; set; }
    /// <summary>normal, important or urgent (<see cref="Domain.ChatUrgencyRules"/>).</summary>
    public string Urgency { get; set; } = "normal";
    /// <summary>The people who have read it.</summary>
    public List<long> SeenBy { get; set; } = [];
    /// <summary>The people who have acknowledged it (urgent messages only).</summary>
    public List<long> AckedBy { get; set; } = [];
    /// <summary>The message this one answers (phase 1), as stored; <see cref="Reply"/> is what the reader may see of it.</summary>
    public long? ReplyToId { get; set; }
    /// <summary>The replied-to message, filled by <see cref="IChatStore.ListMessagesAsync"/> only when the reader may read it (their window, not from someone they blocked); null otherwise.</summary>
    public ChatQuoteRow? Reply { get; set; }
    /// <summary>Everyone's reaction to it (one each), filled by <see cref="IChatStore.ListMessagesAsync"/>.</summary>
    public List<ChatReactionRow> Reactions { get; set; } = [];
    /// <summary>The people whose device has it, filled by <see cref="IChatStore.ListMessagesAsync"/>.</summary>
    public List<long> DeliveredBy { get; set; } = [];
    /// <summary>A message from Stanley carries who he spoke for (company or ship) and the subtitle shown then; null for a person's message. Stanley has no user, so his <see cref="FromUserId"/> is 0.</summary>
    public string? Persona { get; set; }
    public string? Subtitle { get; set; }
    /// <summary>Set on a relayed notice (phase 0b): its lane, kind, link, when it stops being actionable and whether a newer message replaced it. Null on everything else.</summary>
    public string? Lane { get; set; }
    public string? NoticeKey { get; set; }
    public string? SupersedeKey { get; set; }
    public string? NoticeKind { get; set; }
    public string? NoticePath { get; set; }
    /// <summary>The engine card the notice is about (phase 0c), when it has one.</summary>
    public string? NoticeSubject { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? SupersededAt { get; set; }
    /// <summary>Phase 2: when the sender last edited it, and when they deleted it for everyone. A deleted message is never shown to a member again; <see cref="OriginalText"/> is for staff review of a report only.</summary>
    public DateTime? EditedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? OriginalText { get; set; }
    /// <summary>Phase 3: <c>text</c> (the default), <c>card</c> or <c>place</c>, and the server-built JSON of a card or place (<see cref="Domain.ChatCard"/>).</summary>
    public string Kind { get; set; } = "text";
    public string? Payload { get; set; }
    /// <summary>The members it mentions (user ids), filled by <see cref="IChatStore.AddMessageAsync"/> and <see cref="IChatStore.ListMessagesAsync"/>.</summary>
    public List<long> Mentions { get; set; } = [];
    /// <summary>Phase 4: when a poll was closed on demand (it also closes by itself 24 hours after it was sent).</summary>
    public DateTime? ClosedAt { get; set; }
    public bool FromStanley => FromUserId == 0;
}

/// <summary>The person's own place in one conversation: the access check every read and write goes through (docs/chat-plan.md, 4.1).</summary>
public class ChatMemberRow
{
    public long GroupId { get; set; }
    public Guid GroupPublicId { get; set; }
    public string Kind { get; set; } = "party";
    public string Name { get; set; } = "";
    public long UserId { get; set; }
    public string Status { get; set; } = "active";
    public DateTime JoinedAt { get; set; }
    public DateTime? LeftAt { get; set; }
    /// <summary>Muted right now: switched on and not past <see cref="MutedUntil"/> (the store applies the expiry, so every reader agrees).</summary>
    public bool Muted { get; set; }
    /// <summary>When a timed mute ends (real UTC); null for no end, or when not muted.</summary>
    public DateTime? MutedUntil { get; set; }
    /// <summary>When the member archived the conversation; null when it is in their main list.</summary>
    public DateTime? ArchivedAt { get; set; }
    /// <summary>The member tells the other connected members when they leave or return to the ship.</summary>
    public bool NotifyAway { get; set; }
    /// <summary>Phase 3: the member is alerted only for a message that mentions them (the conversation still shows and counts everything).</summary>
    public bool MentionsOnly { get; set; }
    /// <summary>Phase 4: the second admin of a made group (the creator is always one, and is not flagged).</summary>
    public bool IsAdmin { get; set; }
    /// <summary>Phase 4: only admins post in this group.</summary>
    public bool AnnouncementOnly { get; set; }
    public long? LastReadMessageId { get; set; }
    /// <summary>The guest who made a group (null for the booking's group, a direct chat and Stanley's): the one who may pin in it.</summary>
    public long? CreatedByUserId { get; set; }
    /// <summary>A direct chat whose connection has ended: readable, but sending is closed.</summary>
    public bool DirectEnded { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>The permanent Stanley chat only: who he last spoke for, and the subtitle shown. Null for every other conversation.</summary>
    public string? Persona { get; set; }
    public string? Subtitle { get; set; }
}

/// <summary>A conversation in the person's list: their place in it, its last visible message and how many they have not read.</summary>
public sealed class ChatConversationRow : ChatMemberRow
{
    public long? LastMessageId { get; set; }
    public long? LastFromUserId { get; set; }
    public string? LastText { get; set; }
    public bool LastPhoto { get; set; }
    public string LastUrgency { get; set; } = "normal";
    public DateTime? LastAt { get; set; }
    /// <summary>The last message was deleted for everyone (its text is then empty here).</summary>
    public bool LastDeleted { get; set; }
    public int Unread { get; set; }
}

/// <summary>Someone who should hear about a new message: an active member other than the sender who has not blocked the sender.</summary>
public sealed class ChatRecipientRow
{
    public long UserId { get; set; }
    public bool Muted { get; set; }
    /// <summary>The recipient allows message text on their lock screen (off unless they turned it on).</summary>
    public bool ShowPreview { get; set; }
    /// <summary>The recipient has the typing indicator on (it is on unless they turned it off); one who has it off is never sent "is typing".</summary>
    public bool Typing { get; set; } = true;
    /// <summary>Phase 3: the recipient chose to be alerted only when mentioned.</summary>
    public bool MentionsOnly { get; set; }
}

/// <summary>One conversation's presence change for a member: what the chat last knew (<c>Previous</c>) and whether the member wants the chat told.</summary>
public sealed class ChatAwayClaimRow
{
    public long GroupId { get; set; }
    public string? Previous { get; set; }
    public bool NotifyAway { get; set; }
}

/// <summary>Someone to tell that a member left or returned: an active member of the conversation who is connected to the sender and neither has blocked the other.</summary>
public sealed class ChatAwayRecipientRow
{
    public long GroupId { get; set; }
    public Guid GroupPublicId { get; set; }
    public long UserId { get; set; }
    public bool Muted { get; set; }
}

/// <summary>A member's last recorded presence (<c>ashore</c> or <c>back</c>) in one conversation, for the header.</summary>
public sealed record ChatPresenceRow(long UserId, string Status);

/// <summary>A pinned message as the pin bar shows it: the message, who said it, its text (or a card's title) and when it was sent.</summary>
public sealed class ChatPinRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long FromUserId { get; set; }
    public string Text { get; set; } = "";
    public string Kind { get; set; } = "text";
    public string? Payload { get; set; }
    public bool HasPhoto { get; set; }
    public DateTime At { get; set; }
}

/// <summary>One person's answer to a poll (<c>Choice</c> is the option index) or a plan (0 going, 1 maybe, 2 no). <c>AddedToPlan</c>: this answer put the plan's event on their programme.</summary>
public sealed record ChatResponseRow(long MessageId, long UserId, int Choice, bool AddedToPlan);

/// <summary>One person's reaction to one message.</summary>
public sealed record ChatReactionRow(long MessageId, long UserId, string Emoji);

/// <summary>The part of a replied-to message a quote shows.</summary>
public sealed class ChatQuoteRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long FromUserId { get; set; }
    public string Text { get; set; } = "";
    public bool HasPhoto { get; set; }
    public bool IsSystem { get; set; }
    /// <summary>The original was deleted for everyone: the quote then shows only "Message removed".</summary>
    public bool Deleted { get; set; }
}

/// <summary>A message stored by <see cref="IChatStore.AddMessageAsync"/>. <c>Created</c> is false when the same <c>clientId</c> had been sent before and the stored message came back.</summary>
public sealed record ChatSentRow(ChatMessageRow Row, bool Created);

/// <summary>How many times one event happened for one kind and lane of Stanley notice (phase 0c delivery log).</summary>
public sealed record NoticeDeliveryCount(string Kind, string Lane, string Event, int Count);

/// <summary>Phase 10c store: on-board bookings, requests, reports, drinks, money, parties, group tables, games, the TV, last-minute tours and port readiness. Writes that put something on the account take the lines in the same transaction and replace every line of that source.</summary>
public interface IAboardStore
{
    Task<List<SelectionRow>> ListSelectionsAsync(long bookingId, CancellationToken ct);
    /// <summary>Adds the selection, or replaces the quantity of the one for the same item, day and time; the account lines replace the old.</summary>
    Task<SelectionRow> SaveSelectionAsync(long bookingId, SelectionRow selection, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task<bool> RemoveSelectionAsync(long bookingId, Guid publicId, CancellationToken ct);

    Task<List<ServiceRequestRow>> ListRequestsAsync(long bookingId, CancellationToken ct);
    Task AddRequestAsync(long bookingId, ServiceRequestRow request, CancellationToken ct);
    Task<bool> CancelRequestAsync(long bookingId, Guid publicId, CancellationToken ct);
    /// <summary>Records an escalation, closure confirmation or reopen on the booking's request; false when it is not theirs.</summary>
    Task<bool> AddRequestEventAsync(long bookingId, Guid publicId, string kind, DateTime at, CancellationToken ct);

    Task<List<SafetyReportRow>> ListReportsAsync(long bookingId, CancellationToken ct);
    Task AddReportAsync(long bookingId, SafetyReportRow report, CancellationToken ct);

    /// <summary>The person's drinks since the moment given.</summary>
    Task<List<DrinkLogRow>> ListDrinksAsync(long userId, DateTime since, CancellationToken ct);
    Task AddDrinkAsync(long userId, string drinkId, DateTime at, CancellationToken ct);
    Task<bool> RemoveDrinkAsync(long userId, Guid publicId, CancellationToken ct);

    Task<List<TopUpRow>> ListTopUpsAsync(long bookingId, CancellationToken ct);
    /// <summary>Adds a top-up and its credit on the account (dated at the moment the desk settles it).</summary>
    Task AddTopUpAsync(long bookingId, TopUpRow topUp, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task<OnboardAccountRow> GetAccountAsync(long bookingId, CancellationToken ct);
    Task SetPinAsync(long bookingId, byte[] hash, byte[] salt, CancellationToken ct);
    /// <summary>Counts a wrong PIN and returns the number of misses so far.</summary>
    Task<int> RecordPinFailAsync(long bookingId, CancellationToken ct);
    Task ResetPinFailsAsync(long bookingId, CancellationToken ct);
    Task SaveGratuityAsync(long bookingId, string choice, string reason, DateTime at, IReadOnlyList<FolioWrite> folio, CancellationToken ct);
    Task SetCurrencyAsync(long bookingId, string code, CancellationToken ct);

    Task<List<PartyRow>> ListPartiesAsync(long bookingId, CancellationToken ct);
    Task AddPartyAsync(long bookingId, PartyRow party, CancellationToken ct);
    Task<bool> RemovePartyAsync(long bookingId, Guid publicId, CancellationToken ct);

    /// <summary>The table for one of the booking's dining reservations (still booked), else null.</summary>
    Task<GroupTableRow?> GetGroupAsync(long bookingId, Guid reservationPublicId, CancellationToken ct);
    Task AddFriendAsync(long reservationId, string name, string cabin, CancellationToken ct);
    Task RemoveFriendAsync(long reservationId, int seq, CancellationToken ct);
    Task SetSplitAsync(long reservationId, string split, CancellationToken ct);

    Task<string?> GetGameAsync(long userId, CancellationToken ct);
    Task SaveGameAsync(long userId, string json, CancellationToken ct);

    Task<string?> GetTvAsync(long bookingId, CancellationToken ct);
    Task SaveTvAsync(long bookingId, string json, CancellationToken ct);

    Task<HashSet<string>> GetReadyAsync(long bookingId, int day, CancellationToken ct);
    Task SetReadyAsync(long bookingId, int day, string itemId, bool done, DateTime at, CancellationToken ct);

    /// <summary>Books a last-minute tour (<c>Source = onboard</c>) and puts it on the account in one go.</summary>
    Task BookLastMinuteAsync(long bookingId, NewTour tour, IReadOnlyList<FolioWrite> folio, DateTime at, CancellationToken ct);
}

/// <summary>
/// Conversations and their messages (docs/chat-plan.md, phase 4), and the safeguards of MSG-05. Every read and write is for one conversation and goes through <see cref="GetMemberAsync"/>:
/// there is no query that spans conversations except the list and the unread counts, which return numbers and ids only.
/// </summary>
public interface IChatStore
{
    /// <summary>Makes the travel party chat of each of the person's confirmed bookings (everyone on the booking is in it) and adds them to ones that exist; a person with no confirmed booking gets a solo "My group", so there is always one conversation to open.</summary>
    Task EnsurePartyAsync(long userId, CancellationToken ct);
    /// <summary>
    /// Makes the person's permanent Stanley chat if they have none (one per account, enforced by a unique index), with the welcome as its first message. Safe to repeat and to race: the second caller finds the first one's thread.
    /// This is both the registration step and the backfill for accounts that existed before it.
    /// </summary>
    Task EnsureStanleyAsync(long userId, string welcome, DateTime now, CancellationToken ct);
    /// <summary>
    /// Records that Stanley now speaks for <paramref name="persona"/> in the person's Stanley chat: a system line, only if his latest persona there is different, so a repeat adds nothing.
    /// Returns the persona he spoke under before (null when there was none), so the caller can choose the line's words.
    /// </summary>
    Task<(string Voice, string Subtitle)?> LastStanleyPersonaAsync(long userId, CancellationToken ct);
    Task AddStanleyLineAsync(long userId, string text, string voice, string subtitle, DateTime at, CancellationToken ct);
    /// <summary>
    /// Writes a company or ship notice into the person's Stanley thread (phase 0b), once per <see cref="Domain.StanleyNotice.Key"/>: a repeat adds nothing and returns false. A notice with a supersede key marks the
    /// earlier messages of that occasion as replaced. Returns true when a message was added.
    /// </summary>
    /// <summary>
    /// Writes one row of the relay's delivery log: kind, lane, key and time, never the text. A repeat of the same (person, key, event) adds nothing, so a retry or a second tap is counted once.
    /// </summary>
    Task LogNoticeDeliveryAsync(long userId, string noticeKey, string kind, string lane, string evt, DateTime at, CancellationToken ct);
    /// <summary>Counts of delivery events since <paramref name="since"/> by kind, lane and event: aggregates only, no person and no text.</summary>
    Task<List<NoticeDeliveryCount>> NoticeDeliverySummaryAsync(DateTime since, CancellationToken ct);
    Task<bool> AddStanleyNoticeAsync(long userId, Domain.StanleyNotice notice, string voice, string subtitle, DateTime at, CancellationToken ct);
    /// <summary>Phase 6: what the person has been shown as suggestion cards and what they did with each (no text), for the engine's caps and "don't show again unless the facts change".</summary>
    Task<List<Domain.MomentHistory>> ListMomentsAsync(long userId, CancellationToken ct);
    /// <summary>Records that a card was posted: a new row, or the existing one with its post time, expiry and facts renewed and any put-away or snooze cleared.</summary>
    Task SaveMomentAsync(long userId, Domain.MomentHistory moment, CancellationToken ct);
    /// <summary>Puts a card away: <c>Not now</c> (a snooze) or <c>Don't show again</c> (dismissed with the facts it was about). The message is marked replaced so it stops offering its action. False when the person has no such moment.</summary>
    Task<bool> PutAwayMomentAsync(long userId, long messageId, string momentKey, DateTime? dismissedAt, DateTime? snoozedUntil, DateTime at, CancellationToken ct);
    /// <summary>The suggestion topics the person turned off, as a space-separated list (empty when none).</summary>
    Task<string> GetTopicsOffAsync(long userId, CancellationToken ct);
    Task SetTopicsOffAsync(long userId, string topics, CancellationToken ct);
    /// <summary>The person's active conversations, newest activity first, each with its last visible message and unread count.</summary>
    Task<List<ChatConversationRow>> ListConversationsAsync(long userId, CancellationToken ct);
    /// <summary>The person's place in one conversation, or null when they are not (or never were) a member. The check behind every other call.</summary>
    Task<ChatMemberRow?> GetMemberAsync(long userId, Guid conversationId, CancellationToken ct);
    /// <summary>Everyone who is, or was, in the conversation, with names and receipt choice.</summary>
    Task<List<ChatPeerRow>> ListMembersAsync(long groupId, CancellationToken ct);
    /// <summary>The members of several conversations in one query, by conversation id (the list screen would otherwise ask once per conversation).</summary>
    Task<Dictionary<long, List<ChatPeerRow>>> ListMembersForAsync(IReadOnlyCollection<long> groupIds, CancellationToken ct);
    /// <summary>Everyone who shares any conversation with the person, the person excluded (for blocking and read receipts).</summary>
    Task<List<ChatPeerRow>> ListPeersAsync(long userId, CancellationToken ct);
    /// <summary>
    /// A page of messages in arrival order, oldest first: the newest <paramref name="limit"/> before the message <paramref name="before"/> (or the latest). Only messages in the member's window
    /// (from when they joined to when they left; the booking's group shows all) and not from someone the member blocked. One extra message is read so the caller can tell there is more.
    /// </summary>
    Task<List<ChatMessageRow>> ListMessagesAsync(long groupId, long userId, Guid? before, int limit, CancellationToken ct);
    /// <summary>Stores a message in the conversation. With a <paramref name="clientId"/> a repeat returns the stored message and creates nothing.</summary>
    /// <param name="replyToId">The stored id of the message this one answers (already checked to be in the same conversation and readable by the sender), or null.</param>
    /// <param name="kind">Phase 3: <c>text</c>, <c>card</c> or <c>place</c>; <paramref name="payload"/> is the card's JSON. <paramref name="mentions"/> are members (user ids) the message mentions, stored with it.</param>
    Task<ChatSentRow> AddMessageAsync(long groupId, long userId, string text, string? photo, Guid? clientId, DateTime at, CancellationToken ct, bool viaSms = false, string urgency = "normal", long? replyToId = null, string kind = "text", string? payload = null, IReadOnlyCollection<long>? mentions = null);
    /// <summary>Records that a device of the person has one message (by its public id). False when it was already recorded, so only the first is told to the sender.</summary>
    Task<bool> AddDeliveryAsync(Guid messagePublicId, long userId, DateTime at, CancellationToken ct);
    /// <summary>The person's reaction to the message, or null when they have none.</summary>
    Task<string?> GetReactionAsync(long messageId, long userId, CancellationToken ct);
    /// <summary>Sets the person's one reaction to the message (replacing any), or clears it when <paramref name="emoji"/> is null.</summary>
    Task SetReactionAsync(long messageId, long userId, string? emoji, DateTime at, CancellationToken ct);
    /// <summary>Everyone's reaction to one message.</summary>
    Task<List<ChatReactionRow>> ListReactionsAsync(long messageId, CancellationToken ct);
    /// <summary>
    /// Records that a device of the person has every message in the conversation that others sent (in their window). Returns the senders of the messages that were newly marked, so a repeat tells no one:
    /// only those senders need a nudge.
    /// </summary>
    Task<List<long>> MarkDeliveredAsync(long groupId, long userId, DateTime at, CancellationToken ct);
    /// <summary>The members to tell about a message from <paramref name="senderId"/>: active, not the sender, and not having blocked the sender.</summary>
    Task<List<ChatRecipientRow>> ListRecipientsAsync(long groupId, long senderId, CancellationToken ct);
    /// <summary>Marks everything in the conversation read for the person; with <paramref name="receipts"/> also records who read each message.</summary>
    Task MarkReadAsync(long groupId, long userId, bool receipts, DateTime at, CancellationToken ct);
    /// <summary>Mutes or unmutes. <paramref name="until"/> (real UTC) ends a timed mute by itself; null mutes until turned off.</summary>
    Task SetMutedAsync(long groupId, long userId, bool on, CancellationToken ct, DateTime? until = null);
    /// <summary>Moves the conversation into the member's archive, or back out.</summary>
    Task SetArchivedAsync(long groupId, long userId, DateTime? at, CancellationToken ct);
    /// <summary>A new message from someone else brings an archived conversation back for the members who are not muting it.</summary>
    Task UnarchiveOthersAsync(long groupId, long senderId, CancellationToken ct);
    /// <summary>
    /// Edits the sender's own message: sets the text and <c>EditedAt</c>, keeping the first text in <c>OriginalText</c>. Only while it is the sender's, not deleted, and sent at or after <paramref name="windowStart"/>
    /// (so a change that races the window closing is refused). False when nothing changed.
    /// </summary>
    Task<bool> EditMessageAsync(long messageId, long userId, string text, DateTime at, DateTime windowStart, CancellationToken ct);
    /// <summary>Deletes the sender's own message for everyone, with the same guard as <see cref="EditMessageAsync"/>: the text is blanked and <c>OriginalText</c> keeps it for staff review of a report. False when nothing changed.</summary>
    Task<bool> DeleteMessageAsync(long messageId, long userId, DateTime at, DateTime windowStart, CancellationToken ct);
    /// <summary>How many messages the person has sent to the conversation since <paramref name="since"/> (the send rate limit).</summary>
    Task<int> CountSentInAsync(long groupId, long userId, DateTime since, CancellationToken ct);
    /// <summary>The newest message in the conversation a person said that the reader may read (their window, nobody they blocked), or null: what a header Report of a person files.</summary>
    Task<ChatMessageRow?> FindLatestFromAsync(long groupId, long readerId, long fromUserId, CancellationToken ct);
    /// <summary>The conversation's pinned messages the person may read (their window, not from someone they blocked, not deleted), oldest pin first.</summary>
    Task<List<ChatPinRow>> ListPinsAsync(long groupId, long userId, CancellationToken ct);
    /// <summary>Pins the message unless the conversation already has <paramref name="max"/> pins. Returns false when it is full; pinning a message that is already pinned changes nothing and returns true.</summary>
    Task<bool> PinAsync(long groupId, long messageId, long pinnedBy, DateTime at, int max, CancellationToken ct);
    Task UnpinAsync(long groupId, long messageId, CancellationToken ct);
    /// <summary>The message ids of the conversation that are pinned, so a thread page can mark them.</summary>
    Task<HashSet<long>> ListPinnedIdsAsync(long groupId, CancellationToken ct);
    /// <summary>Records the person's answer to a poll or plan, replacing an earlier one (a vote can be changed).</summary>
    Task SetResponseAsync(long messageId, long userId, int choice, bool addedToPlan, DateTime at, CancellationToken ct);
    /// <summary>The person's answer to a poll or plan, or null when they have none.</summary>
    Task<ChatResponseRow?> GetResponseAsync(long messageId, long userId, CancellationToken ct);
    /// <summary>Everyone's answers to the given polls and plans, in one query.</summary>
    Task<List<ChatResponseRow>> ListResponsesAsync(IReadOnlyCollection<long> messageIds, CancellationToken ct);
    /// <summary>Closes a poll now. False when it was already closed on demand.</summary>
    Task<bool> ClosePollAsync(long messageId, DateTime at, CancellationToken ct);
    /// <summary>Switches "alert me only when I am mentioned" on or off for the member.</summary>
    Task SetMentionsOnlyAsync(long groupId, long userId, bool on, CancellationToken ct);
    /// <summary>
    /// What the header may say about the other members' presence: only members who turned "tell this chat when I leave or return" on, are connected to the reader (an accepted connection) and have not blocked them
    /// nor been blocked, and have a recorded presence.
    /// </summary>
    Task<List<ChatPresenceRow>> ListPresenceAsync(long groupId, long readerId, CancellationToken ct);
    /// <summary>Turns "tell this chat when I leave or return to the ship" on or off for the member.</summary>
    Task SetNotifyAwayAsync(long groupId, long userId, bool on, CancellationToken ct);
    /// <summary>
    /// Records the person's new presence on every conversation they are active in and returns the ones where it changed, with what each knew before and whether the person wants it shared.
    /// A repeat of the same status returns nothing, so a retried scan tells no one twice.
    /// </summary>
    Task<List<ChatAwayClaimRow>> ClaimAwayAsync(long userId, string status, CancellationToken ct);
    /// <summary>Who to tell in these conversations about the sender: active members, connected to the sender (an accepted connection), with no block either way.</summary>
    Task<List<ChatAwayRecipientRow>> ListAwayRecipientsAsync(long userId, IReadOnlyCollection<long> groupIds, CancellationToken ct);
    /// <summary>Adds a system line in the conversation, attributed to the person it is about.</summary>
    Task AddSystemLineAsync(long groupId, long userId, string text, DateTime at, CancellationToken ct);
    /// <summary>One message the person may read in the conversation (their window, not from someone they blocked), or null.</summary>
    Task<ChatMessageRow?> FindMessageAsync(long groupId, long userId, Guid messagePublicId, CancellationToken ct);
    /// <summary>Records that the person acknowledged the message; false when they already had (nothing changes).</summary>
    Task<bool> AddAckAsync(long messageId, long userId, DateTime at, CancellationToken ct);
    /// <summary>The urgent messages from others that the person may read and has not acknowledged, as (conversation id, message id), for the badge and the pinned state.</summary>
    Task<List<(Guid ConversationId, Guid MessageId)>> ListUnackedUrgentAsync(long userId, CancellationToken ct);
    /// <summary>How many messages of this level the person has sent since <paramref name="since"/>, over every conversation, for the hourly limit.</summary>
    Task<int> CountSentAsync(long userId, string urgency, DateTime since, CancellationToken ct);
    /// <summary>Unread messages over every conversation, for the tab badge.</summary>
    Task<int> UnreadTotalAsync(long userId, CancellationToken ct);
    /// <summary>Whether the person has the typing indicator on (it is on unless they turned it off).</summary>
    Task<bool> GetTypingAsync(long userId, CancellationToken ct);
    Task<bool> GetReceiptsAsync(long userId, CancellationToken ct);
    Task SetReceiptsAsync(long userId, bool on, CancellationToken ct);
    Task<List<long>> ListBlocksAsync(long userId, CancellationToken ct);
    Task SetBlockAsync(long userId, long blockedUserId, bool on, CancellationToken ct);
    /// <summary>Records a report about a message in a conversation the person is in; false if there is no such message.</summary>
    Task<bool> AddReportAsync(long userId, Guid messagePublicId, string reason, DateTime at, CancellationToken ct);
}
